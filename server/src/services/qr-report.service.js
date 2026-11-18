const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { CATEGORY } = require('../utils/constants');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
function validateToken(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw new ApiError(404, 'This QR code is invalid or no longer available.');
}
function available(asset) {
  if (!asset) throw new ApiError(404, 'This QR code is invalid or no longer available.');
  if (asset.status !== 'ACTIVE') throw new ApiError(410, 'This equipment is inactive. Contact society management for help.');
  return asset;
}
function authorized(asset, user) {
  available(asset);
  if (!user || user.disabled) throw new ApiError(401, 'Your account is no longer available. Please sign in again.');
  if (user.role !== 'RESIDENT' || !user.societyId || user.societyId !== asset.societyId)
    throw new ApiError(403, 'Only residents of this society can report a fault on this equipment.');
  return asset;
}
async function identifyAsset(token) {
  validateToken(token);
  const asset = available(await prisma.asset.findUnique({ where: { qrToken: token }, select: { name: true, assetCode: true, location: true, category: true, status: true } }));
  const { status, ...identification } = asset;
  return identification;
}
async function resolveReportAsset(token, residentId, db = prisma) {
  validateToken(token);
  const [asset, user] = await Promise.all([
    db.asset.findUnique({ where: { qrToken: token }, select: { id: true, societyId: true, status: true, category: true } }),
    db.user.findUnique({ where: { id: residentId }, select: { role: true, disabled: true, societyId: true } }),
  ]);
  return authorized(asset, user);
}
async function lockReportAsset(tx, token, residentId) {
  // Recheck after a potentially slow upload and hold shared row locks until insert commits.
  // Concurrent deactivation, demotion, deletion or membership changes cannot slip through.
  const users = await tx.$queryRaw`SELECT "role", "disabled", "societyId" FROM "users" WHERE "id" = ${residentId} FOR SHARE`;
  const assets = await tx.$queryRaw`SELECT "id", "societyId", "status", "category" FROM "assets" WHERE "qrToken" = ${token} FOR SHARE`;
  return authorized(assets[0], users[0]);
}
function complaintCategory(asset) {
  const category = asset.category.trim().toUpperCase();
  return Object.values(CATEGORY).includes(category) ? category : CATEGORY.OTHER;
}
module.exports = { identifyAsset, resolveReportAsset, lockReportAsset, complaintCategory, TOKEN_PATTERN };
