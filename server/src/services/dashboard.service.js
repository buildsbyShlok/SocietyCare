const prisma = require('../config/db');
const { ROLES } = require('../utils/constants');
const { societyScope, complaintScope } = require('../utils/society-scope');

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Converts a Prisma groupBy result into a flat {STATUS: count} object.
 * All three Status enum values are always present, defaulting to 0.
 *
 * @param {Array} rows - Prisma groupBy result
 * @returns {{ OPEN: number, IN_PROGRESS: number, RESOLVED: number }}
 */
function toStatusMap(rows) {
  const map = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const row of rows) map[row.status] = row._count.status;
  return map;
}

/**
 * Converts a Prisma groupBy result into a flat {CATEGORY: count} object.
 * All seven Category enum values are always present, defaulting to 0.
 *
 * @param {Array} rows - Prisma groupBy result
 * @returns {object}
 */
function toCategoryMap(rows) {
  const map = {
    PLUMBING: 0, ELECTRICAL: 0, CLEANING: 0,
    SECURITY: 0, LIFT: 0, PARKING: 0, OTHER: 0,
  };
  for (const row of rows) map[row.category] = row._count.category;
  return map;
}

// ─── Resident Stats ───────────────────────────────────────────────────────────

/**
 * Returns complaint statistics scoped to a single resident.
 *
 * All three queries run in parallel via Promise.all.
 *
 * @param {string} userId
 * @returns {{ role, totalComplaints, byStatus, byCategory }}
 */
async function getResidentStats(user) {
  const where = { ...complaintScope(user), archivedAt:null, deletedAt:null };

  const [statusRows, categoryRows, total] = await Promise.all([
    prisma.complaint.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
    prisma.complaint.groupBy({
      by: ['category'],
      where,
      _count: { category: true },
    }),
    prisma.complaint.count({ where }),
  ]);

  return {
    role:            ROLES.RESIDENT,
    totalComplaints: total,
    byStatus:        toStatusMap(statusRows),
    byCategory:      toCategoryMap(categoryRows),
  };
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

/**
 * Returns society-wide complaint statistics for admin.
 *
 * Overdue = unresolved complaints created more than OVERDUE_THRESHOLD_DAYS ago.
 * All four queries run in parallel via Promise.all.
 *
 * @returns {{ role, totalComplaints, byStatus, byCategory, overdueCount }}
 */
async function getAdminStats(user) {
  const scope = societyScope(user), where = { ...scope, archivedAt: null, deletedAt: null };
  const linked = { ...where, assetId: { not: null }, asset: scope };
  const [groups, overdueCount, assetGroups, openAssetComplaints, frequent] = await Promise.all([
    prisma.complaint.groupBy({ by: ['status', 'category', 'source'], where, _count: { _all: true } }),
    prisma.complaint.count({ where: { ...where, isOverdue: true } }),
    prisma.asset.groupBy({ by: ['status'], where: scope, _count: { status: true } }),
    prisma.complaint.count({ where: { ...linked, status: 'OPEN' } }),
    prisma.complaint.groupBy({ by: ['assetId'], where: linked, _count: { assetId: true }, orderBy: [{ _count: { assetId: 'desc' } }, { assetId: 'asc' }], take: 5 }),
  ]);
  const byStatus = toStatusMap([]), byCategory = toCategoryMap([]);
  let totalComplaints = 0, qrComplaints = 0;
  for (const row of groups) {
    const count = row._count._all;
    totalComplaints += count; byStatus[row.status] += count; byCategory[row.category] += count;
    if (row.source === 'QR') qrComplaints += count;
  }
  const assetStatus = { ACTIVE: 0, INACTIVE: 0 };
  for (const row of assetGroups) assetStatus[row.status] = row._count.status;
  // One bounded lookup for the top five; no per-asset count/name queries.
  const assets = frequent.length ? await prisma.asset.findMany({ where: { ...scope, id: { in: frequent.map(row => row.assetId) } }, select: { id: true, name: true, assetCode: true } }) : [];
  const names = new Map(assets.map(asset => [asset.id, asset]));
  return {
    role: ROLES.ADMIN, totalComplaints, byStatus, byCategory, overdueCount,
    assets: { active: assetStatus.ACTIVE, inactive: assetStatus.INACTIVE, qrComplaints, openComplaints: openAssetComplaints,
      mostReported: frequent.filter(row => names.has(row.assetId)).map(row => ({ ...names.get(row.assetId), complaintCount: row._count.assetId })) },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns role-scoped dashboard statistics.
 *
 * @param {{ id: string, role: string }} user - From authenticate middleware
 * @returns {object}
 */
async function getDashboardStats(user) {
  if (user.role === ROLES.RESIDENT) return getResidentStats(user);
  return getAdminStats(user);
}

module.exports = { getDashboardStats };
