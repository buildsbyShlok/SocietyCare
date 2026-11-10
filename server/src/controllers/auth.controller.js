const { registerUser, loginUser, findUserById } = require('../services/auth.service');

/**
 * Auth Controller
 *
 * Intentionally thin — each function parses the request,
 * delegates all business logic to auth.service.js, and responds.
 *
 * Token storage: The frontend stores the JWT in localStorage and sends it
 * via the Authorization header. The logout endpoint clears any residual
 * HttpOnly cookie (defensive), so cookie-aware clients are also handled.
 */

async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await findUserById(req.user.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * Logout — clears any residual auth cookie and signals the client to
 * drop its locally stored token. Idempotent and does not require auth.
 *
 * POST /api/auth/logout
 */
async function logout(req, res) {
  // Clear any HttpOnly cookie named 'token' if one was ever set
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json({ message: 'Logged out successfully.' });
}

module.exports = { register, login, getMe, logout };
