const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, getMe, logout } = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { validateRegister, validateLogin } = require('../validations/auth.validation');

const router = Router();
const limiterOptions = {
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts from this IP. Please try again in 15 minutes.' },
};
// Separate stores: registration cannot consume the login allowance. Successful
// logins do not count, so local QA remains convenient with production protection.
const loginLimiter = rateLimit({ ...limiterOptions, skipSuccessfulRequests: true });
const registerLimiter = rateLimit(limiterOptions);

router.post('/register', registerLimiter, validate(validateRegister), register);
router.post('/login', loginLimiter, validate(validateLogin), login);
router.get('/me', authenticate, getMe);

/**
 * POST /api/auth/logout
 * Clears any residual auth cookie. No authentication required — idempotent.
 */
router.post('/logout', logout);

module.exports = router;
