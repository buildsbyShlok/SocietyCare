const ApiError = require('./ApiError');
function societyScope(user) {
  if (!Number.isSafeInteger(user?.societyId) || user.societyId < 1)
    throw new ApiError(403, 'Your society membership could not be verified.');
  return { societyId: user.societyId };
}
function complaintScope(user) {
  return { ...societyScope(user), ...(user.role === 'RESIDENT' ? { residentId: user.id } : {}) };
}
module.exports = { societyScope, complaintScope };
