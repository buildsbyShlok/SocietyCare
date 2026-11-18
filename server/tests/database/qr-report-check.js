const assert = require('node:assert/strict');
const request = require('supertest');
const { randomInt } = require('node:crypto');

module.exports = async ({ api, app, tx, asset, path, a, r, outsider, complaint }) => {
  const publicPath = '/api/assets/qr/' + asset.qrToken;
  const identification = (await request(app).get(publicPath).expect(200)).body;
  assert.deepEqual(Object.keys(identification).sort(), ['assetCode', 'category', 'location', 'name']);
  await request(app).get('/api/assets/qr/' + 'x'.repeat(43)).expect(404);
  await request(app).get('/api/assets/qr/malformed').expect(404);
  const payload = { qrToken: asset.qrToken, title: 'QA QR lift fault', description: 'QR report from the authenticated resident for this equipment.', priority: 'HIGH' };
  const enrollment = { name: 'QA enrollment', flatNumber: 'QA', email: 'enroll-' + asset.id + '@example.test', password: 'qa-only-password', qrToken: asset.qrToken };
  for (const extra of [{ role: 'ADMIN' }, { disabled: false }, { societyId: 2 }]) {
    await request(app).post('/api/auth/register').send({ ...enrollment, ...extra }).expect(400);
  }
  const receipt = await request(app).post('/api/auth/register').send(enrollment).expect(201);
  assert.equal(receipt.body.token, undefined);
  const registered = await tx.user.findUniqueOrThrow({ where: { email: enrollment.email } });
  assert.equal(registered.societyId, asset.societyId);
  const login = () => request(app).post('/api/auth/login').send({email: enrollment.email, password: enrollment.password});
  await login().expect(401);
  const approval = '/users/' + registered.id + '/enrollment';
  const pendingToken = require('jsonwebtoken').sign({id:registered.id},process.env.JWT_SECRET);
  for (const route of ['/complaints','/community','/users','/assets','/society']) {
    await api('get',route,pendingToken).expect(401);
  }
  await api('patch', approval, r).expect(403);
  await api('patch', approval, a).expect(200);
  await api('patch', approval, a).expect(409);
  const session = await login().expect(200);
  const accepted = await api('post','/complaints',session.body.token).send(payload).expect(201);
  const linked = await tx.complaint.findUniqueOrThrow({where:{id:accepted.body.complaint.id}});
  assert.equal(linked.assetId, asset.id); assert.equal(linked.source, "QR");
  // Keep the pre-existing active queue expectations independent of this resolved enrollment check.
  await tx.complaint.update({where:{id:accepted.body.complaint.id},data:{archivedAt:new Date()}});
  await request(app).post('/api/complaints').send(payload).expect(401);
  await api('post', '/complaints', a).send(payload).expect(403);
  const submitted = (await api('post', '/complaints', r).send(payload).expect(201)).body.complaint;
  let saved = await tx.complaint.findUnique({ where: { id: submitted.id } });
  const ownerId = (await tx.complaint.findUnique({ where: { id: complaint.id } })).residentId;
  assert.equal(saved.residentId, ownerId); assert.equal(saved.assetId, asset.id); assert.equal(saved.source, 'QR'); assert.equal(saved.category, 'LIFT');
  assert.equal((await tx.complaint.findUnique({ where: { id: complaint.id } })).source, 'MANUAL');
  await api('get', '/complaints/' + submitted.id, r).expect(200);
  await api('get', '/complaints/' + submitted.id, outsider).expect(403);
  await api('patch', '/complaints/' + submitted.id + '/status', a).send({ status: 'IN_PROGRESS', remark: 'Maintenance is investigating the QR report.' }).expect(200);
  assert.equal(await tx.complaintHistory.count({ where: { complaintId: submitted.id } }), 1);

  for (const field of ['assetId', 'residentId', 'societyId', 'source', 'category'])
    await api('post', '/complaints', r).send({ ...payload, [field]: 'forged' }).expect(400);
  await api('post', '/complaints', r).send({ ...payload, qrToken: 'x'.repeat(43) }).expect(404);
  await api('patch', path + '/status', a).send({ status: 'INACTIVE' }).expect(200);
  await request(app).get(publicPath).expect(410);
  await api('post', '/complaints', r).send(payload).expect(410);
  await api('patch', path + '/status', a).send({ status: 'ACTIVE' }).expect(200);

  const societyId = randomInt(1000000000, 2000000000);
  await tx.society.create({ data: { id: societyId, name: 'Transaction-only other society', address: '', description: '' } });
  await tx.user.update({ where: { id: ownerId }, data: { societyId } });
  await api('post', '/complaints', r).send(payload).expect(403);
  await tx.user.update({ where: { id: ownerId }, data: { societyId: asset.societyId } });

  // Multipart requests use the same complaint/upload pipeline as the regular form.
  await api('post', '/complaints', outsider).field('qrToken', asset.qrToken).field('title', payload.title).field('description', payload.description).field('priority', 'LOW').expect(201);
  await api('post', '/complaints', outsider).field('qrToken', asset.qrToken).field('title', payload.title).field('description', payload.description).field('priority', 'LOW').attach('photo', Buffer.from('not an image'), { filename: 'bad.png', contentType: 'image/png' }).expect(400);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  await api('post', '/complaints', outsider).field('qrToken', asset.qrToken).field('title', payload.title).field('description', payload.description).field('priority', 'LOW').attach('photo', png, { filename: 'test.png', contentType: 'image/png' }).expect(503);

  let limited;
  for (let i = 0; i < 12; i++) { limited = await api('post', '/complaints', r).send(payload); if (limited.status === 429) break; }
  assert.equal(limited.status, 429);
  await api('post', '/complaints', r).send({ title: payload.title, description: payload.description, category: 'OTHER', priority: 'LOW' }).expect(201);
  console.log('PASS QR identification privacy, source/asset/session binding, cross-society/admin/anonymous/inactive/tampering denial, multipart uploads, history and isolated QR rate limit');
};
