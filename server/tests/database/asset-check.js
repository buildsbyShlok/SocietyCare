const assert = require('node:assert/strict');
const request = require('supertest');

// Called inside workspace-check's real PostgreSQL transaction; all fixtures roll back.
module.exports = async function checkAssets({ api, app, tx, admin, a, r, outsider, salt }) {
  const payload = { name: 'QA lift', assetCode: 'QA-' + salt, location: 'QA tower lobby', category: 'Lift', description: 'Transactional asset verification' };
  const asset = (await api('post', '/assets', a).send(payload).expect(201)).body;
  const path = '/assets/' + asset.id;
  assert.equal(asset.status, 'ACTIVE');
  assert.equal(asset.assetCode, payload.assetCode.toUpperCase());
  assert.match(asset.qrToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(asset.id, asset.qrToken);
  assert.equal((await api('get', path, a).expect(200)).body.name, payload.name);
  const list = (await api('get', '/assets?limit=100', a).expect(200)).body;
  assert.ok(list.items.some(item => item.id === asset.id));
  const page = (await api('get', '/assets?limit=1', a).expect(200)).body;
  assert.equal(page.items.length, 1); assert.equal(page.hasNext, page.total > 1);

  // Unique-constraint failures abort PostgreSQL transactions; contain expected conflicts.
  async function conflict(method, url, data) {
    await tx.$executeRawUnsafe('SAVEPOINT asset_conflict');
    try { await api(method, url, a).send(data).expect(409); }
    finally { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT asset_conflict'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT asset_conflict'); }
  }
  await conflict('post', '/assets', { ...payload, assetCode: payload.assetCode.toLowerCase() });
  const second = (await api('post', '/assets', a).send({ ...payload, assetCode: payload.assetCode + '-2' }).expect(201)).body;
  assert.notEqual(second.qrToken, asset.qrToken);
  await conflict('put', '/assets/' + second.id, payload);
  await api('delete', '/assets/' + second.id, a).expect(200);
  await api('get', '/assets/' + second.id, a).expect(404);
  const edited = (await api('put', path, a).send({ ...payload, name: 'QA lift updated', location: 'QA lobby revised' }).expect(200)).body;
  assert.equal(edited.location, 'QA lobby revised'); assert.equal(edited.qrToken, asset.qrToken);
  for (const status of ['INACTIVE', 'ACTIVE']) {
    const changed = (await api('patch', path + '/status', a).send({ status }).expect(200)).body;
    assert.equal(changed.status, status); assert.equal(changed.qrToken, asset.qrToken);
    assert.equal((await api('get', path, a).expect(200)).body.status, status);
  }
  await api('patch', path + '/status', a).send({ status: 'BROKEN' }).expect(400);
  await api('put', path, a).send({ ...payload, qrToken: 'forged' }).expect(400);
  await api('post', '/assets', a).send({ ...payload, name: '' }).expect(400);
  await api('get', '/assets/missing', a).expect(404);
  await api('put', '/assets/missing', a).send(payload).expect(404);
  await api('patch', '/assets/missing/status', a).send({ status: 'ACTIVE' }).expect(404);
  for (const [method, url, data] of [['get', '/assets', {}], ['post', '/assets', payload], ['get', path, {}], ['put', path, payload], ['patch', path + '/status', { status: 'INACTIVE' }], ['delete', path, {}]]) {
    await request(app)[method]('/api' + url).send(data).expect(401);
    await api(method, url, r).send(data).expect(403);
    await api(method, url, outsider).send(data).expect(403);
  }
  await tx.user.update({ where: { id: admin.id }, data: { role: 'RESIDENT' } });
  await api('patch', path + '/status', a).send({ status: 'INACTIVE' }).expect(403);
  await tx.user.update({ where: { id: admin.id }, data: { role: 'ADMIN', disabled: true } });
  await api('get', path, a).expect(401);
  await tx.user.update({ where: { id: admin.id }, data: { disabled: false } });

  const complaint = (await api('post', '/complaints', r).send({ title: 'QA existing complaint workflow', description: 'The original complaint form still works without an asset.', category: 'OTHER', priority: 'LOW' }).expect(201)).body.complaint;
  assert.equal((await tx.complaint.findUnique({ where: { id: complaint.id } })).assetId, null);
  // Verify the optional relation without adding any public reporting/submission API.
  await tx.complaint.update({ where: { id: complaint.id }, data: { assetId: asset.id } });
  await api('get', '/complaints/' + complaint.id, r).expect(200);
  await api('get', '/complaints/' + complaint.id, outsider).expect(403);
  await api('patch', '/complaints/' + complaint.id + '/status', a).send({ status: 'IN_PROGRESS', remark: 'QA compatibility check' }).expect(200);
  assert.equal(await tx.complaintHistory.count({ where: { complaintId: complaint.id } }), 1);
  await require('./qr-report-check')({ api, app, tx, asset, path, a, r, outsider, complaint });
  await require('./phase3-admin-check')({ api, tx, admin, asset, a, r, salt });
  await api('delete', path, a).expect(409);
  assert.equal((await tx.complaint.findUnique({ where: { id: complaint.id } })).assetId, asset.id);
  assert.equal((await api('get', path, a).expect(200)).body.status, 'ACTIVE');
  console.log('PASS asset CRUD/status/deletion, unique codes/tokens, pagination, validation, all-endpoint RBAC, immediate demotion/disable and protected complaint history');
};
