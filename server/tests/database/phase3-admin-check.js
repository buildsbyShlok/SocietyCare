const assert = require('node:assert/strict');
const { randomInt } = require('node:crypto');

// Runs inside workspace-check's transaction. It exercises the Phase 3 views through
// the real Express API and verifies the SQL-backed figures rather than fixtures.
module.exports = async function checkAdminComplaintIntegration({ api, tx, admin, asset, a, r, salt }) {
  const manual = (await api('post', '/complaints', r).send({
    title: 'QA manual complaint remains available',
    description: 'A normal resident complaint used to verify manual source filtering.',
    category: 'OTHER', priority: 'LOW',
  }).expect(201)).body.complaint;
  const savedManual = await tx.complaint.findUnique({ where: { id: manual.id } });
  assert.equal(savedManual.source, 'MANUAL');
  assert.equal(savedManual.assetId, null);

  const qrComplaint = await tx.complaint.findFirst({
    where: { societyId: asset.societyId, assetId: asset.id, source: 'QR', deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(qrComplaint, 'The Phase 2 QR check must create a linked QR complaint.');

  const all = (await api('get', '/complaints?assetId=' + asset.id, a).expect(200)).body;
  assert.ok(all.items.length > 0);
  assert.ok(all.items.every(item => item.asset?.id === asset.id));
  assert.ok(all.items.every(item => item.asset?.assetCode === asset.assetCode));
  assert.ok(all.items.every(item => item.asset?.qrToken === undefined));

  const qr = (await api('get', '/complaints?source=QR&assetId=' + asset.id, a).expect(200)).body;
  assert.ok(qr.items.some(item => item.id === qrComplaint.id));
  assert.ok(qr.items.every(item => item.source === 'QR' && item.asset?.id === asset.id));
  const manualResults = (await api('get', '/complaints?source=MANUAL', a).expect(200)).body;
  assert.ok(manualResults.items.some(item => item.id === manual.id));
  assert.ok(manualResults.items.every(item => item.source === 'MANUAL'));
  await api('get', '/complaints?source=INVALID', a).expect(400);

  const detail = (await api('get', '/complaints/' + qrComplaint.id, a).expect(200)).body.complaint;
  assert.equal(detail.source, 'QR');
  assert.deepEqual(Object.keys(detail.asset).sort(), ['assetCode', 'category', 'id', 'location', 'name']);
  assert.equal(detail.asset.id, asset.id);

  const unrelated = await tx.asset.create({ data: {
    name: 'QA unrelated asset', assetCode: 'UNRELATED-' + salt, description: '',
    location: 'QA service room', category: 'Pump', qrToken: 'unrelated-' + salt,
    societyId: asset.societyId,
  } });
  const unrelatedComplaint = await tx.complaint.create({ data: {
    title: 'Unrelated asset record', description: 'Must not enter another asset history.',
    category: 'OTHER', priority: 'LOW', source: 'MANUAL', assetId: unrelated.id,
    residentId: admin.id, societyId: asset.societyId,
  } });
  const history = (await api('get', '/assets/' + asset.id + '/complaints?limit=100', a).expect(200)).body;
  assert.ok(history.items.some(item => item.id === qrComplaint.id));
  assert.ok(history.items.every(item => item.id !== unrelatedComplaint.id));
  assert.equal(history.totalItems, await tx.complaint.count({ where: { societyId: asset.societyId, assetId: asset.id, deletedAt: null } }));
  assert.equal(history.byStatus.OPEN, await tx.complaint.count({ where: { societyId: asset.societyId, assetId: asset.id, deletedAt: null, status: 'OPEN' } }));
  assert.equal(history.byStatus.RESOLVED, await tx.complaint.count({ where: { societyId: asset.societyId, assetId: asset.id, deletedAt: null, status: 'RESOLVED' } }));

  const dashboard = (await api('get', '/dashboard', a).expect(200)).body;
  const scope = { societyId: asset.societyId, archivedAt: null, deletedAt: null };
  assert.equal(dashboard.assets.qrComplaints, await tx.complaint.count({ where: { ...scope, source: 'QR' } }));
  assert.equal(dashboard.assets.openComplaints, await tx.complaint.count({ where: { ...scope, assetId: { not: null }, status: 'OPEN' } }));
  assert.equal(dashboard.assets.active, await tx.asset.count({ where: { societyId: asset.societyId, status: 'ACTIVE' } }));
  assert.equal(dashboard.assets.inactive, await tx.asset.count({ where: { societyId: asset.societyId, status: 'INACTIVE' } }));
  assert.ok(dashboard.assets.mostReported.some(item => item.id === asset.id));

  const otherSocietyId = randomInt(1000000000, 2000000000);
  const otherSociety = await tx.society.create({ data: { id: otherSocietyId, name: 'Phase 3 isolation society', address: '', description: '' } });
  const otherResident = await tx.user.create({ data: {
    name: 'Other society resident', email: 'phase3-' + salt + '@example.test', password: admin.password,
    flatNumber: 'P3', role: 'RESIDENT', societyId: otherSociety.id,
  } });
  const otherAsset = await tx.asset.create({ data: {
    name: 'Other society asset', assetCode: 'OTHER-' + salt, description: '', location: 'Other lobby',
    category: 'Lift', qrToken: 'other-' + salt, societyId: otherSociety.id,
  } });
  const otherComplaint = await tx.complaint.create({ data: {
    title: 'Other society complaint', description: 'Isolation fixture.', category: 'LIFT', priority: 'MEDIUM',
    source: 'QR', assetId: otherAsset.id, residentId: otherResident.id, societyId: otherSociety.id,
  } });
  await tx.user.update({ where: { id: admin.id }, data: { societyId: otherSociety.id } });
  try {
    const directory = (await api('get', '/users', a).expect(200)).body.data;
    assert.ok(directory.some(user => user.id === otherResident.id));
    assert.ok(!directory.some(user => user.id === savedManual.residentId));
    await api('patch', '/users/' + savedManual.residentId + '/role', a).send({ role: 'ADMIN' }).expect(404);
    await api('patch', '/users/' + savedManual.residentId + '/enrollment', a).expect(404);
    await api('delete', '/users/' + savedManual.residentId, a).expect(404);
    for (const path of ['/community', '/events', '/notices']) await api('get', path, a).expect(403);
    const settings = (await api('get', '/society', a).expect(200)).body;
    assert.equal(settings.society.id, otherSociety.id);
    const isolatedAssets = (await api('get', '/assets?limit=100', a).expect(200)).body;
    assert.ok(isolatedAssets.items.some(item => item.id === otherAsset.id));
    assert.ok(!isolatedAssets.items.some(item => item.id === asset.id));
    await api('get', '/assets/' + asset.id, a).expect(404);
    await api('get', '/assets/' + asset.id + '/complaints', a).expect(404);
    await api('get', '/complaints/' + qrComplaint.id, a).expect(404);
    await api('patch', '/complaints/' + qrComplaint.id + '/status', a).send({ status: 'RESOLVED' }).expect(404);
    const isolatedComplaints = (await api('get', '/complaints?source=QR', a).expect(200)).body;
    assert.ok(isolatedComplaints.items.some(item => item.id === otherComplaint.id));
    assert.ok(!isolatedComplaints.items.some(item => item.id === qrComplaint.id));
  } finally {
    await tx.user.update({ where: { id: admin.id }, data: { societyId: asset.societyId } });
  }
  console.log('PASS Phase 3 admin complaint source/asset filters, details, linked history, dashboard metrics and society isolation');
};
