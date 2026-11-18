const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../../src/config/db');
const app = require('../../app');

process.env.JWT_SECRET = 'isolated-authorization-test-secret';
const token = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

test('Current database identity, complaint access and role changes', async (t) => {
  const accounts = new Map([
    ['manager', { id: 'manager', societyId: 1, role: 'ADMIN' }],
    ['target', { id: 'target', societyId: 1, role: 'ADMIN' }],
    ['resident', { id: 'resident', societyId: 1, role: 'RESIDENT' }],
  ]);
  const original = { transaction: prisma.$transaction, raw: prisma.$queryRaw, count: prisma.user.count, find: prisma.user.findUnique, update: prisma.user.update, list: prisma.user.findMany, complaint: prisma.complaint.findUnique };
  t.after(() => {
    prisma.$transaction = original.transaction; prisma.$queryRaw = original.raw; prisma.user.count = original.count;
    prisma.user.findUnique = original.find;
    prisma.user.update = original.update;
    prisma.user.findMany = original.list;
    prisma.complaint.findUnique = original.complaint;
  });
  prisma.$transaction = async work => work(prisma);
  prisma.$queryRaw = async () => [{locked:1}];
  prisma.user.count = async () => [...accounts.values()].filter(u => u.role === 'ADMIN' && !u.disabled).length;
  prisma.user.findUnique = async ({ where }) => accounts.get(where.id) || null;
  prisma.user.update = async ({ where, data }) => {
    Object.assign(accounts.get(where.id), data);
    return accounts.get(where.id);
  };
  prisma.user.findMany = async () => [...accounts.values()];
  const complaint = { id: 'ticket', status: 'OPEN', resident: { id: 'resident' }, history: [{ id: 'history', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', remark: 'QA note' }] };
  prisma.complaint.findUnique = async ({ where }) => where.id === 'ticket' ? complaint : null;
  const managerToken = token('manager', 'ADMIN');
  const oldAdminToken = token('target', 'ADMIN');
  const residentToken = token('resident', 'RESIDENT');
  const get = (path, jwtToken) => request(app).get(path).auth(jwtToken, { type: 'bearer' });

  await t.test('existing admin and resident RBAC', async () => {
    assert.equal((await get('/api/users', oldAdminToken)).status, 200);
    assert.equal((await get('/api/users', residentToken)).status, 403);
  });
  await t.test('owner and admin receive complaint and preserved history', async () => {
    for (const jwtToken of [residentToken, managerToken]) {
      const response = await get('/api/complaints/ticket', jwtToken);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.complaint, complaint);
    }
  });
  await t.test('demotion through role endpoint immediately rejects old admin token', async () => {
    assert.equal((await request(app).patch('/api/users/target/role').auth(managerToken, { type: 'bearer' }).send({ societyId: 1, role: 'RESIDENT' })).status, 200);
    assert.equal((await get('/api/users', oldAdminToken)).status, 403);
    assert.equal((await get('/api/complaints/ticket', oldAdminToken)).status, 403);
    assert.equal((await request(app).patch('/api/complaints/ticket/status').auth(oldAdminToken, { type: 'bearer' }).send({ status: 'RESOLVED', remark: 'Denied' })).status, 403);
    assert.equal((await get('/api/auth/me', oldAdminToken)).body.user.role, 'RESIDENT');
  });
  await t.test('promotion works with old resident token', async () => {
    assert.equal((await request(app).patch('/api/users/resident/role').auth(managerToken, { type: 'bearer' }).send({ societyId: 1, role: 'ADMIN' })).status, 200);
    assert.equal((await get('/api/users', residentToken)).status, 200);
  });
  await t.test('missing complaint is 404', async () => {
    assert.equal((await get('/api/complaints/missing', managerToken)).status, 404);
  });
  await t.test('deleted account cannot reuse token', async () => {
    accounts.delete('target');
    assert.equal((await get('/api/users', oldAdminToken)).status, 401);
    assert.equal((await get('/api/auth/me', oldAdminToken)).status, 401);
  });
  await t.test('malformed signed identity is rejected before database query', async () => {
    const bad = jwt.sign({ societyId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
    assert.equal((await get('/api/users', bad)).status, 401);
  });
  await t.test('database failure fails closed', async () => {
    prisma.user.findUnique = async () => { throw new Error('Database unavailable'); };
    assert.equal((await get('/api/users', managerToken)).status, 500);
  });
});

test('Login/register protection does not lock out session restoration or logout', async (t) => {
  const original = prisma.user.findUnique;
  const password = await bcrypt.hash('Test-only-password-123', 4);
  prisma.user.findUnique = async () => ({ id: 'resident', societyId: 1, role: 'RESIDENT', password });
  t.after(() => { prisma.user.findUnique = original; });
  const residentToken = token('resident', 'RESIDENT');
  for (let i = 0; i < 20; i++) {
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'qa@example.test', password: 'Test-only-password-123' })).status, 200);
    assert.equal((await request(app).get('/api/auth/me').auth(residentToken, { type: 'bearer' })).status, 200);
  }
  for (let i = 0; i < 15; i++) assert.equal((await request(app).post('/api/auth/login').send({})).status, 400);
  assert.equal((await request(app).post('/api/auth/login').send({})).status, 429);
  // Independent registration store remains usable, then enforces its own limit.
  for (let i = 0; i < 15; i++) assert.equal((await request(app).post('/api/auth/register').send({})).status, 400);
  assert.equal((await request(app).post('/api/auth/register').send({})).status, 429);
  assert.equal((await request(app).get('/api/auth/me').auth(residentToken, { type: 'bearer' })).status, 200);
  assert.equal((await request(app).post('/api/auth/logout')).status, 200);
});
