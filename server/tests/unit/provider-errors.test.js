const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const ai = require('../../src/services/ai.service');
const cloudinary = require('../../src/config/cloudinary');
const prisma = require('../../src/config/db');
const { uploadImage } = require('../../src/services/image.service');
const image = require('../fixtures/image');
const content = { title: 'Leaking garden tap', category: 'PLUMBING', priority: 'LOW', confidence: 0 };
const response = value => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(value) } }] }) });

test('Groq request bounds, safe errors and model fallback', async t => {
  const key = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = ' test-only ';
  t.after(() => key === undefined ? delete process.env.GROQ_API_KEY : process.env.GROQ_API_KEY = key);
  await t.test('JSON mode, trimmed key, timeout signal and supported fallback', async t => {
    const models = [];
    t.mock.method(global, 'fetch', async (_, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      assert.ok(options.signal instanceof AbortSignal);
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, 'json_object');
      models.push(body.model);
      return models.length === 1 ? { ok: false, status: 404 } : response(content);
    });
    assert.equal((await ai.analyzeComplaint('A leaking garden tap requires repair.')).confidence, 0);
    assert.deepEqual(models, ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);
  });
  for (const status of [401, 403, 429]) {
    await t.test('provider status ' + status + ' stops retries without leaking payload', async t => {
      let calls = 0;
      t.mock.method(global, 'fetch', async () => {
        calls++;
        return { ok: false, status, headers: new Headers({ 'retry-after': '90' }), text: () => { throw Error('must not read private response'); } };
      });
      await assert.rejects(ai.analyzeComplaint('A leaking garden tap requires repair.'), e =>
        e.statusCode === (status === 429 ? 429 : 503) && (status !== 429 || e.retryAfter === 90));
      assert.equal(calls, 1);
    });
  }
  await t.test('timeout maps to 504 with no model retry', async t => {
    let calls = 0;
    t.mock.method(global, 'fetch', async () => { calls++; throw new DOMException('private', 'TimeoutError'); });
    await assert.rejects(ai.analyzeComplaint('A leaking garden tap requires repair.'), e => e.statusCode === 504 && !e.message.includes('private'));
    assert.equal(calls, 1);
  });
  await t.test('malformed JSON retries, then returns controlled error', async t => {
    let calls = 0;
    t.mock.method(global, 'fetch', async () => { calls++; return response(null); });
    await assert.rejects(ai.analyzeComplaint('A leaking garden tap requires repair.'), e => e.statusCode === 422);
    assert.equal(calls, 2);
  });
  await t.test('duplicate results reject unknown/null IDs, remove repeats and exclude archived/deleted records', async t => {
    const original = prisma.complaint.findMany;
    t.after(() => { prisma.complaint.findMany = original; });
    prisma.complaint.findMany = async query => {
      assert.equal(query.where.deletedAt, null);
      assert.equal(query.where.archivedAt, null);
      return [{ id: 'known', title: 'Garden tap', description: 'A leaking tap' }];
    };
    t.mock.method(global, 'fetch', async () => response({ matches: [null, { complaintId: 'unknown', similarity: 99 }, { complaintId: 'known', similarity: 95 }, { complaintId: 'known', similarity: 90 }] }));
    const results = await ai.detectDuplicates('Garden tap leaking.', { id: 'test-admin', role: 'ADMIN', societyId: 1 });
    assert.equal(results.length, 1);
    assert.equal(results[0].complaintId, 'known');
  });
  await t.test('malformed duplicate output is an error, not a false no-match result', async t => {
    const original = prisma.complaint.findMany;
    t.after(() => { prisma.complaint.findMany = original; });
    prisma.complaint.findMany = async () => [{ id: 'known', title: 'Tap', description: 'Tap leak' }];
    t.mock.method(global, 'fetch', async () => response(null));
    await assert.rejects(ai.detectDuplicates('Garden tap leaking.', { id: 'test-admin', role: 'ADMIN', societyId: 1 }), e => e.statusCode === 422);
  });
});

test('shared image uploader validates bytes, limits, result and sanitizes provider failures', async t => {
  t.mock.method(cloudinary, 'assertConfigured', () => {});
  await t.test('returns both secure URL and public ID', async t => {
    t.mock.method(cloudinary.uploader, 'upload_stream', (options, cb) => {
      assert.equal(options.timeout, 30000);
      const stream = new PassThrough();
      stream.on('finish', () => cb(null, { secure_url: 'https://res.cloudinary.com/test/image/upload/test.png', public_id: 'test/qa' }));
      return stream;
    });
    assert.deepEqual(await uploadImage(image, 'avatars'), { url: 'https://res.cloudinary.com/test/image/upload/test.png', publicId: 'test/qa' });
  });
  await t.test('spoofed content and oversize avatar rejected before upload', async t => {
    t.mock.method(cloudinary.uploader, 'upload_stream', () => { assert.fail('must not upload'); });
    await assert.rejects(uploadImage({ mimetype: 'image/png', buffer: Buffer.from('<svg/>') }, 'complaints'), e => e.statusCode === 400);
    await assert.rejects(uploadImage({ ...image, buffer: Buffer.concat([image.buffer, Buffer.alloc(2 * 1024 * 1024)]) }, 'avatars'), e => e.statusCode === 400);
  });
  await t.test('callback and stream errors never disclose provider details', async t => {
    for (const type of ['callback', 'stream']) {
      t.mock.method(cloudinary.uploader, 'upload_stream', (_, cb) => {
        const stream = new PassThrough();
        stream.on('finish', () => type === 'callback' ? cb({ http_code: 401, message: 'SECRET' }) : stream.emit('error', Error('SECRET')));
        return stream;
      });
      await assert.rejects(uploadImage(image, 'events'), e => [502, 503].includes(e.statusCode) && !e.message.includes('SECRET'));
    }
  });
  await t.test('hard upload deadline rejects stalled stream', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.mock.method(cloudinary.uploader, 'upload_stream', () => new PassThrough());
    const result = assert.rejects(uploadImage(image, 'events'), e => e.statusCode === 504);
    t.mock.timers.tick(30000);
    await result;
  });
});
