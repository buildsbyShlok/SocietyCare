const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../src/config/db');
const service = require('../../src/services/asset.service');
const app = require('../../app');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'asset-test-secret-only';
function mock(t, target, key, fn) { const original = target[key]; t.after(() => { target[key] = original; }); target[key] = fn; }
const admin = { id: 'admin', role: 'ADMIN', societyId: 1 };
const valid = { name: 'Lift 1', assetCode: 'lift-a_01', location: 'Tower A lobby', category: 'Lift', description: 'Passenger lift' };

test('asset input normalizes codes and validates every field', () => {
  assert.equal(service.assetData(valid).assetCode, 'LIFT-A_01');
  assert.equal(service.assetData({ ...valid, description: '  ' }).description, '');
  for (const body of [null, [], {}, { ...valid, name: 5 }, { ...valid, name: ' ' }, { ...valid, name: 'x'.repeat(121) }, { ...valid, assetCode: 'bad/code' }, { ...valid, assetCode: 'x'.repeat(65) }, { ...valid, location: 'x'.repeat(241) }, { ...valid, category: {} }, { ...valid, category: 'x'.repeat(81) }, { ...valid, description: 'x'.repeat(2001) }, { ...valid, description: false }, { ...valid, qrToken: 'forged' }, { ...valid, status: 'ACTIVE' }, { ...valid, id: 'forged' }])
    assert.throws(() => service.assetData(body), e => e.statusCode === 400);
});

test('asset creation generates distinct 256-bit tokens unrelated to internal IDs', async t => {
  mock(t, prisma.asset, 'create', async ({ data }) => ({ id: 'internal-id', ...data }));
  const first = await service.createAsset(valid, admin), second = await service.createAsset(valid, admin);
  assert.match(first.qrToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.qrToken, second.qrToken);
  assert.notEqual(first.qrToken, first.id);
});

test('asset edits and status changes cannot replace QR tokens', async t => {
  const calls = [];
  mock(t, prisma.asset, 'update', async args => { calls.push(args); return args.data; });
  await service.updateAsset('asset-1', valid, admin);
  for (const status of ['INACTIVE', 'ACTIVE']) await service.setAssetStatus('asset-1', { status }, admin);
  assert.ok(calls.every(call => !('qrToken' in call.data)));
  assert.deepEqual(calls[1].data, { status: 'INACTIVE' });
  for (const body of [null, {}, { status: 'active' }, { status: true }, { status: ['ACTIVE'] }, { status: 'ACTIVE', qrToken: 'forged' }])
    assert.throws(() => service.setAssetStatus('asset-1', body, admin), e => e.statusCode === 400);
});

test('asset deletion is transactional and preserves linked complaint history', async t => {
  const calls = [];
  let linkedComplaints = 0;
  mock(t, prisma, '$transaction', async work => work({
    asset: {
      update: async args => { calls.push(['update', args]); return { id: 'asset-1' }; },
      delete: async args => { calls.push(['delete', args]); return { id: 'asset-1' }; },
    },
    complaint: { count: async () => linkedComplaints },
  }));
  assert.deepEqual(await service.deleteAsset('asset-1', admin), { id: 'asset-1' });
  assert.equal(calls[0][0], 'update');
  assert.equal(calls[0][1].data.status, 'INACTIVE');
  assert.equal(calls[1][0], 'delete');

  linkedComplaints = 1;
  await assert.rejects(service.deleteAsset('asset-1', admin), error => error.statusCode === 409);
});

test('asset uniqueness races, missing assets and bounded pagination use controlled responses', async t => {
  mock(t, prisma.asset, 'create', async () => { throw { code: 'P2002' }; });
  mock(t, prisma.asset, 'update', async () => { throw { code: 'P2025' }; });
  mock(t, prisma.asset, 'findUnique', async () => null);
  await assert.rejects(service.createAsset(valid, admin), e => e.statusCode === 409);
  await assert.rejects(service.updateAsset('missing', valid, admin), e => e.statusCode === 404);
  await assert.rejects(service.getAsset('missing', admin), e => e.statusCode === 404);
  let args;
  mock(t, prisma.asset, 'findMany', async query => { args = query; return []; });
  mock(t, prisma.asset, 'count', async () => 0);
  await service.listAssets({ page: '-1', limit: '999999' }, admin);
  assert.equal(args.take, 100); assert.equal(args.skip, 0);
});

test('all asset endpoints reject unauthenticated, resident, demoted and disabled accounts', async t => {
  let user = { id: 'actor', role: 'RESIDENT', disabled: false };
  mock(t, prisma.user, 'findUnique', async () => user);
  const token = jwt.sign({ id: 'actor', role: 'ADMIN' }, process.env.JWT_SECRET);
  const routes = [['get', '/'], ['post', '/'], ['get', '/asset-1'], ['put', '/asset-1'], ['patch', '/asset-1/status'], ['delete', '/asset-1']];
  for (const [method, path] of routes) {
    await request(app)[method]('/api/assets' + path).send(valid).expect(401);
    await request(app)[method]('/api/assets' + path).auth(token, { type: 'bearer' }).send(valid).expect(403);
  }
  user = { id: 'actor', role: 'ADMIN', disabled: true };
  await request(app).get('/api/assets').auth(token, { type: 'bearer' }).expect(401);
  user = null;
  await request(app).get('/api/assets').auth(token, { type: 'bearer' }).expect(401);
});

test('asset PUT preflight is supported for browser clients', async () => {
  const response = await request(app).options('/api/assets/asset-1').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'PUT').expect(204);
  assert.ok(response.headers['access-control-allow-methods'].split(',').includes('PUT'));
});
