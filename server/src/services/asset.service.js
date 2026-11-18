const { randomBytes } = require('node:crypto');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { field } = require('../utils/workspace');
const pagination = require('../utils/pagination');
const { societyScope } = require('../utils/society-scope');

function bodyFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !allowed.includes(key)))
    throw new ApiError(400, 'Invalid asset fields.');
}

function assetData(body) {
  bodyFields(body, ['name', 'assetCode', 'description', 'location', 'category']);
  const assetCode = field(body.assetCode, 'asset code', 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(assetCode))
    throw new ApiError(400, 'Asset code must use letters, numbers, hyphens or underscores.');
  return {
    name: field(body.name, 'asset name', 120), assetCode,
    description: field(typeof body.description === 'string' ? body.description.trim() : body.description, 'description', 2000, true),
    location: field(body.location, 'location', 240),
    category: field(body.category, 'category', 80),
  };
}

// Enforce uniqueness in PostgreSQL, including concurrent admin writes.
async function write(operation) {
  try { return await operation(); }
  catch (error) {
    if (error.code === 'P2002') throw new ApiError(409, 'An asset with this code already exists. Choose another code.');
    if (error.code === 'P2025') throw new ApiError(404, 'Asset not found.');
    throw error;
  }
}

async function listAssets(query, user) {
  const { page, limit, skip, take } = pagination(query, 12);
  const where = societyScope(user);
  if (query.search) {
    const search = field(query.search, 'asset search', 100);
    where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { assetCode: { contains: search, mode: 'insensitive' } }];
  }
  const select = query.options === 'true' ? { id: true, name: true, assetCode: true, status: true } : undefined;
  const [items, total] = await Promise.all([
    prisma.asset.findMany({ where, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
    prisma.asset.count({ where }),
  ]);
  return { items, total, page, hasNext: page * limit < total };
}

async function getAsset(id, user) {
  const asset = await prisma.asset.findUnique({ where: { id, ...societyScope(user) } });
  if (!asset) throw new ApiError(404, 'Asset not found.');
  return asset;
}

function createAsset(body, user) {
  const data = assetData(body);
  return write(() => prisma.asset.create({ data: { ...data, ...societyScope(user), qrToken: randomBytes(32).toString('base64url') } }));
}

function updateAsset(id, body, user) {
  const data = assetData(body);
  return write(() => prisma.asset.update({ where: { id, ...societyScope(user) }, data }));
}

function setAssetStatus(id, body, user) {
  bodyFields(body, ['status']);
  if (!['ACTIVE', 'INACTIVE'].includes(body.status)) throw new ApiError(400, 'Status must be ACTIVE or INACTIVE.');
  return write(() => prisma.asset.update({ where: { id, ...societyScope(user) }, data: { status: body.status } }));
}

async function deleteAsset(id, user) {
  return write(() => prisma.$transaction(async tx => {
    // Lock the asset as inactive before checking history. A QR submission that is
    // already in flight will recheck this state while holding its own row lock.
    const asset = await tx.asset.update({
      where: { id, ...societyScope(user) },
      data: { status: 'INACTIVE' },
      select: { id: true },
    });
    const linkedComplaints = await tx.complaint.count({
      where: { ...societyScope(user), assetId: id },
    });
    if (linkedComplaints) {
      throw new ApiError(409, 'This asset has linked complaint history. Deactivate it instead to preserve the record.');
    }
    await tx.asset.delete({ where: { id, ...societyScope(user) } });
    return asset;
  }));
}

async function assetComplaints(id, query, user) {
  await getAsset(id, user);
  const { page, limit, skip, take } = pagination(query);
  // History includes archived records, but never soft-deleted complaints.
  const where = { ...societyScope(user), assetId: id, deletedAt: null };
  const [items, groups] = await Promise.all([
    prisma.complaint.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
      id: true, title: true, status: true, source: true, createdAt: true, archivedAt: true,
      resident: { select: { name: true, flatNumber: true } },
    } }),
    prisma.complaint.groupBy({ by: ['status'], where, _count: { status: true } }),
  ]);
  const byStatus = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const row of groups) byStatus[row.status] = row._count.status;
  const totalItems = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  return { items, currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems,
    hasNextPage: page * limit < totalItems, hasPreviousPage: page > 1, byStatus };
}

module.exports = { listAssets, getAsset, createAsset, updateAsset, setAssetStatus, deleteAsset, assetData, assetComplaints };
