const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/db');

/**
 * Authentication middleware.
 *
 * Verifies the JWT from the Authorization header and attaches
 * the current database identity to req.user for downstream authorization.
 *
 * Expected header: Authorization: Bearer <token>
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload.id !== 'string' || !payload.id) throw new Error('Missing identity');
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, disabled: true },
    });
    if (!user || user.disabled || !['ADMIN', 'RESIDENT'].includes(user.role)) {
      return next(new ApiError(401, 'Account is no longer available'));
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticate;
