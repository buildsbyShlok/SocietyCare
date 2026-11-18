const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const prisma = require('../../src/config/db');
const report = require('../../src/services/qr-report.service');
const { validateCreateComplaint } = require('../../src/validations/complaint.validation');
const app = require('../../app');
const token = 'q'.repeat(43);
const valid = { qrToken: token, title: 'Lift door stuck', description: 'The door stays open on the ground floor.', priority: 'MEDIUM' };
function mock(t, target, key, fn) { const original = target[key]; t.after(() => { target[key] = original; }); target[key] = fn; }

test('QR complaint validation rejects forged identity, asset and source while preserving manual fields', () => {
  assert.deepEqual(validateCreateComplaint(valid), []);
  for (const change of [{ qrToken: '' }, { qrToken: 'q'.repeat(42) }, { qrToken: [token] }, { assetId: 'other' }, { residentId: 'other' }, { societyId: 2 }, { source: 'MANUAL' }, { category: 'LIFT' }, { priority: 'urgent' }]) assert.ok(validateCreateComplaint({ ...valid, ...change }).length);
  const manual = { title: valid.title, description: valid.description, priority: 'LOW', category: 'LIFT' };
  assert.deepEqual(validateCreateComplaint(manual), []);
  assert.ok(validateCreateComplaint({ ...manual, assetId: 'injected' }).length);
  assert.equal(report.complaintCategory({ category: 'Lift' }), 'LIFT');
  assert.equal(report.complaintCategory({ category: 'Water cooler' }), 'OTHER');
});

test('public QR lookup exposes only equipment identification and distinguishes inactive/missing', async t => {
  let status = 'ACTIVE';
  mock(t, prisma.asset, 'findUnique', async ({ select }) => {
    assert.deepEqual(Object.keys(select).sort(), ['assetCode', 'category', 'location', 'name', 'status']);
    return status ? { name: 'Lift', assetCode: 'LIFT-1', location: 'Lobby', category: 'Lift', status } : null;
  });
  const response = await request(app).get('/api/assets/qr/' + token).expect(200);
  assert.deepEqual(Object.keys(response.body).sort(), ['assetCode', 'category', 'location', 'name']);
  assert.equal(response.headers['cache-control'], 'no-store');
  status = 'INACTIVE'; await request(app).get('/api/assets/qr/' + token).expect(410);
  status = null; await request(app).get('/api/assets/qr/' + token).expect(404);
  await request(app).get('/api/assets/qr/not-a-token').expect(404);
});

test('QR authorization relies on current database membership and role', async t => {
  const asset = { id: 'asset', societyId: 1, status: 'ACTIVE', category: 'Lift' };
  let user = { societyId: 1, role: 'RESIDENT', disabled: false };
  mock(t, prisma.asset, 'findUnique', async () => asset);
  mock(t, prisma.user, 'findUnique', async () => user);
  assert.equal((await report.resolveReportAsset(token, 'resident')).id, 'asset');
  for (const value of [{ ...user, societyId: 2 }, { ...user, societyId: null }, { ...user, role: 'ADMIN' }]) {
    user = value; await assert.rejects(report.resolveReportAsset(token, 'resident'), e => e.statusCode === 403);
  }
  user = { societyId: 1, role: 'RESIDENT', disabled: true };
  await assert.rejects(report.resolveReportAsset(token, 'resident'), e => e.statusCode === 401);
  user = null; await assert.rejects(report.resolveReportAsset(token, 'resident'), e => e.statusCode === 401);
});

test('QR final authorization locks rows and rejects changes during upload', async () => {
  let user = { societyId: 1, role: 'RESIDENT', disabled: false }, asset = { id: 'asset', societyId: 1, status: 'ACTIVE', category: 'Lift' };
  const tx = { $queryRaw: async (strings, value) => {
    const sql = strings.join('?'); assert.match(sql, /FOR SHARE$/);
    if (sql.includes('FROM "users"')) { assert.equal(value, 'resident'); return [user]; }
    assert.equal(value, token); return [asset];
  } };
  assert.equal((await report.lockReportAsset(tx, token, 'resident')).id, 'asset');
  asset = { ...asset, status: 'INACTIVE' }; await assert.rejects(report.lockReportAsset(tx, token, 'resident'), e => e.statusCode === 410);
  asset.status = 'ACTIVE'; user.role = 'ADMIN'; await assert.rejects(report.lockReportAsset(tx, token, 'resident'), e => e.statusCode === 403);
  user.role = 'RESIDENT'; user.societyId = 2; await assert.rejects(report.lockReportAsset(tx, token, 'resident'), e => e.statusCode === 403);
});

test('public QR lookup is rate limited', async t => {
  mock(t, prisma.asset, 'findUnique', async () => null);
  let response;
  for (let i = 0; i < 61; i++) response = await request(app).get('/api/assets/qr/' + token);
  assert.equal(response.status, 429); assert.ok(response.headers['retry-after']);
});
