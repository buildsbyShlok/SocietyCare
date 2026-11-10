// Opt-in: makes real provider requests and retains clearly labelled QA records.
// No credentials are printed. Run only against the local development backend.
require('../../src/config/env');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const jwt = require('jsonwebtoken');
const prisma = require('../../src/config/db');
const image = require('../fixtures/image');
const results = [];
const record = (name, details) => { results.push({ name, ...details }); console.log(name + ': PASS'); };
async function run() {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  const user = await prisma.user.findUnique({ where: { email: process.env.QA_EMAIL || 'integrations.qa.20261108@societycare.local' } });
  assert.ok(user && !user.disabled && user.role === 'RESIDENT');
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const api = async (route, method = 'GET', body, expected = 200) => {
    const response = await fetch('http://localhost:5000/api' + route, {
      method, headers: { Authorization: 'Bearer ' + token, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(40000),
    });
    const json = await response.json();
    assert.equal(response.status, expected, route + ' returned HTTP ' + response.status);
    return json;
  };
  const form = (fields, key, bytes = image.buffer, mime = image.mimetype) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.append(name, value);
    if (key) data.append(key, new Blob([bytes], { type: mime }), 'integration-qa.png');
    return data;
  };
  const fields = { title: 'Integration QA: leaking garden tap', description: 'Integration QA only: The garden tap beside the entrance is leaking water continuously. Please repair the tap washer.', category: 'PLUMBING', priority: 'LOW' };
  const complaint = (await api('/complaints', 'POST', form(fields, 'photo'), 201)).complaint;
  assert.ok(complaint.photoUrl);
  record('Complaint multipart upload', { id: complaint.id, status: 201 });
  const avatar = (await api('/users/profile', 'PATCH', form({}, 'avatar'))).data;
  assert.ok(avatar.avatarUrl);
  record('Avatar multipart upload', { status: 200 });
  const eventFields = { title: 'Integration QA: poster verification', description: 'Technical integration test event. Not a scheduled society activity.', location: 'QA test only', startsAt: '2027-01-10T12:00:00.000Z' };
  const event = (await api('/events', 'POST', form(eventFields, 'image'), 201));
  assert.ok(event.imageUrl);
  record('Event poster upload', { id: event.id, status: 201 });
  const editedEvent = (await api('/events/' + event.id, 'PATCH', form(eventFields, 'image')));
  assert.notEqual(editedEvent.imageUrl, event.imageUrl);
  record('Event poster replacement', { status: 200 });
  const message = (await api('/community', 'POST', form({ body: 'Integration QA attachment verification (test message).' }, 'image'), 201));
  assert.ok(message.imageUrl);
  record('Community attachment upload', { id: message.id, status: 201 });
  // Fresh database connection and HTTP reads ensure results do not rely on the write response.
  await prisma.$disconnect();
  const stored = [
    { row: await prisma.complaint.findUnique({ where: { id: complaint.id } }), url: 'photoUrl', id: 'photoPublicId' },
    { row: await prisma.user.findUnique({ where: { id: user.id } }), url: 'avatarUrl', id: 'avatarPublicId' },
    { row: await prisma.event.findUnique({ where: { id: event.id } }), url: 'imageUrl', id: 'imagePublicId' },
    { row: await prisma.communityMessage.findUnique({ where: { id: message.id } }), url: 'imageUrl', id: 'imagePublicId' },
  ];
  for (const item of stored) {
    assert.ok(item.row[item.id]);
    const response = await fetch(item.row[item.url], { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith('image/'));
    assert.ok((await response.arrayBuffer()).byteLength);
  }
  assert.equal((await api('/complaints/' + complaint.id)).complaint.photoUrl, complaint.photoUrl);
  assert.equal((await api('/auth/me')).user.avatarUrl, avatar.avatarUrl);
  assert.equal((await api('/events/' + event.id)).imageUrl, editedEvent.imageUrl);
  assert.ok((await api('/community')).items.some(m => m.id === message.id && m.imageUrl === message.imageUrl));
  record('PostgreSQL URLs/public IDs, fresh GETs and public image downloads', { images: 4, allHttp200: true });
  const analysis = (await api('/ai/analyze-complaint', 'POST', { complaint: fields.description })).data;
  assert.equal(analysis.category, 'PLUMBING');
  assert.ok(analysis.title && analysis.refinedDescription);
  record('Real Groq complaint assistant', { status: 200, category: analysis.category });
  const matches = (await api('/ai/detect-duplicates', 'POST', { complaint: fields.title + ' ' + fields.description })).data;
  assert.ok(matches.some(m => m.complaintId === complaint.id && m.similarity >= 30));
  record('Real Groq duplicate detection', { status: 200, matchedQaComplaint: true });
  await api('/users/profile', 'PATCH', form({}, 'avatar', Buffer.from('<svg/>')), 400);
  await api('/users/profile', 'PATCH', form({}, 'avatar', Buffer.alloc(2 * 1024 * 1024 + 1)), 400);
  await api('/complaints', 'POST', form(fields, 'photo', Buffer.alloc(5 * 1024 * 1024 + 1)), 400);
  await api('/events', 'POST', form(eventFields, 'image', Buffer.from('<svg/>'), 'image/svg+xml'), 400);
  await api('/ai/analyze-complaint', 'POST', { complaint: 'short' }, 400);
  record('Spoofed content, invalid types, 2MB/5MB limits and short AI input rejected', { status: 400 });
  const noAuth = await fetch('http://localhost:5000/api/complaints', { method: 'POST', body: form(fields, 'photo') });
  assert.equal(noAuth.status, 401);
  record('Upload authentication retained', { status: 401 });
}
run().catch(error => {
  process.exitCode = 1;
  console.log('LIVE CHECK FAILED: ' + (error.code || error.name));
  results.push({ name: 'Failure', type: error.name, code: error.code, assertion: error.operator ? error.message.split('\n')[0] : undefined });
}).finally(async () => {
  await prisma.$disconnect();
  const output = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'societycare-qa');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'integration-live-results.json'), JSON.stringify(results, null, 2));
});
