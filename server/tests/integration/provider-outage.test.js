const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'local-test-secret-not-a-production-secret';
const prisma = require('../../src/config/db');
const app = require('../../app');
test('AI outage leaves normal complaint submission working and upload errors remain actionable', async t => {
  const key = process.env.GROQ_API_KEY;
  const find = prisma.user.findUnique, create = prisma.complaint.create;
  delete process.env.GROQ_API_KEY;
  t.after(() => {
    if (key === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = key;
    prisma.user.findUnique = find; prisma.complaint.create = create;
  });
  prisma.user.findUnique = async () => ({ id: 'qa', societyId: 1, role: 'RESIDENT', disabled: false });
  prisma.complaint.create = async ({ data }) => ({ id: 'qa-ticket', ...data });
  const token = jwt.sign({ id: 'qa' }, process.env.JWT_SECRET);
  const ai = await request(app).post('/api/ai/analyze-complaint').auth(token, { type: 'bearer' }).send({ complaint: 'The garden tap is leaking continuously.' });
  assert.equal(ai.status, 503);
  const complaint = await request(app).post('/api/complaints').auth(token, { type: 'bearer' }).send({
    title: 'Garden tap leaking', description: 'The garden tap is leaking continuously.', category: 'PLUMBING', priority: 'LOW',
  });
  assert.equal(complaint.status, 201);
  assert.equal(complaint.body.complaint.photoUrl, null);
  const avatar = await request(app).patch('/api/users/profile').auth(token, { type: 'bearer' })
    .attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' });
  assert.equal(avatar.status, 400);
  assert.match(avatar.body.message, /2 MB/);
});
