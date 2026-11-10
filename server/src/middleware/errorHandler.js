const ApiError = require('../utils/ApiError');

/**
 * Centralized error response middleware.
 *
 * Must be the last middleware registered in app.js.
 * Catches ApiError instances (thrown in services) and
 * any unhandled runtime errors.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  let statusCode = err instanceof ApiError ? err.statusCode : 500;
  let message = err.message || 'Internal Server Error';

  if (err.type === 'entity.parse.failed') { statusCode = 400; message = 'Invalid JSON request body.'; }
  if (err.type === 'entity.too.large') { statusCode = 413; message = 'Request body is too large.'; }

  // Handle Multer upload limits and type errors gracefully
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = req.originalUrl?.split('?')[0] === '/api/users/profile'
      ? 'File size limit exceeded. Maximum avatar size is 2 MB.'
      : 'File size limit exceeded. Maximum image size is 5 MB.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = `File upload error: ${err.message}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[${new Date().toISOString()}] ${statusCode} — ${message}`);
    if (statusCode === 500) console.error(err.stack);
  }

  if (statusCode === 500) message = 'Internal server error. Please try again.';
  if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
  res.status(statusCode).json({ message });
}

module.exports = errorHandler;
