const ApiError = require('../utils/ApiError');

// Legacy community records belong to the original installation's society.
module.exports = (req, res, next) => req.user.societyId === 1
  ? next()
  : next(new ApiError(403, 'This community workspace is unavailable for your society.'));
