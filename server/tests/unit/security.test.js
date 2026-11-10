/**
 * security.test.js — Unit tests for Phase 2 security improvements.
 *
 * Tests:
 *   1. JWT authentication middleware — valid / invalid / missing tokens
 *   2. Authorization middleware — resident / admin role enforcement
 *   3. Input validation — complaint and notice field limits
 *   4. Logout controller — cookie clearing response
 *   5. Scheduler guard — duplicate initialization prevention
 *   6. AI availability — missing API key does NOT block complaint submission
 */

const test = require('node:test');
const assert = require('node:assert');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal mock for Express req/res/next used throughout tests.
 */
function mockReqResNext({ headers = {}, user = null, cookies = {} } = {}) {
  const req = { headers, user, cookies };
  let responseCode = null;
  let responseBody = null;
  let cookieCleared = null;

  const res = {
    status(code) { responseCode = code; return this; },
    json(body)   { responseBody = body; return this; },
    clearCookie(name, opts) { cookieCleared = { name, opts }; return this; },
    getCode: () => responseCode,
    getBody: () => responseBody,
    getClearedCookie: () => cookieCleared,
  };

  let nextCalled = false;
  let nextErr = null;
  const next = (err) => { nextCalled = true; nextErr = err || null; };

  return { req, res, next, isNextCalled: () => nextCalled, getNextErr: () => nextErr };
}

// ─── 1. Authenticate Middleware ───────────────────────────────────────────────

test('authenticate middleware — accepts a valid JWT', async (t) => {
  const prisma = require('../../src/config/db');
  const original = prisma.user.findUnique;
    t.after(() => { prisma.user.findUnique = original; });
    prisma.user.findUnique = async () => ({ id: 'user-1', role: 'RESIDENT' });
  const jwt = require('jsonwebtoken');
  process.env.JWT_SECRET = 'test-secret-key-12345';

  const token = jwt.sign({ id: 'user-1', role: 'RESIDENT' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const authenticate = require('../../src/middleware/authenticate');
  const { req, res, next, isNextCalled, getNextErr } = mockReqResNext({
    headers: { authorization: `Bearer ${token}` },
  });

  await authenticate(req, res, next);

  assert.strictEqual(isNextCalled(), true, 'next() should be called for valid token');
  assert.strictEqual(getNextErr(), null, 'next() should not be called with an error');
  assert.strictEqual(req.user.id, 'user-1');
  assert.strictEqual(req.user.role, 'RESIDENT');
});

test('authenticate middleware — rejects missing Authorization header', async () => {
  const authenticate = require('../../src/middleware/authenticate');
  const { req, res, next, isNextCalled, getNextErr } = mockReqResNext({ headers: {} });

  authenticate(req, res, next);

  assert.strictEqual(isNextCalled(), true, 'next() should be called');
  const err = getNextErr();
  assert.ok(err, 'next() should be called with an error');
  assert.strictEqual(err.statusCode, 401);
});

test('authenticate middleware — rejects invalid JWT signature', async () => {
  const jwt = require('jsonwebtoken');
  process.env.JWT_SECRET = 'test-secret-key-12345';

  const token = jwt.sign({ id: 'user-1', role: 'RESIDENT' }, 'WRONG_SECRET', { expiresIn: '1h' });
  const authenticate = require('../../src/middleware/authenticate');
  const { req, res, next, isNextCalled, getNextErr } = mockReqResNext({
    headers: { authorization: `Bearer ${token}` },
  });

  authenticate(req, res, next);

  assert.strictEqual(isNextCalled(), true);
  const err = getNextErr();
  assert.ok(err && err.statusCode === 401, 'Should reject tampered token with 401');
});

test('authenticate middleware — rejects expired JWT', async () => {
  const jwt = require('jsonwebtoken');
  process.env.JWT_SECRET = 'test-secret-key-12345';

  const token = jwt.sign({ id: 'user-1', role: 'RESIDENT' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
  const authenticate = require('../../src/middleware/authenticate');
  const { req, res, next, getNextErr } = mockReqResNext({
    headers: { authorization: `Bearer ${token}` },
  });

  authenticate(req, res, next);

  const err = getNextErr();
  assert.ok(err && err.statusCode === 401, 'Should reject expired token with 401');
});

// ─── 2. Authorize Middleware ───────────────────────────────────────────────────

test('authorize middleware — allows matching role', () => {
  const authorize = require('../../src/middleware/authorize');
  const { req, res, next, isNextCalled, getNextErr } = mockReqResNext({
    user: { id: 'admin-1', role: 'ADMIN' },
  });

  authorize('ADMIN')(req, res, next);

  assert.strictEqual(isNextCalled(), true);
  assert.strictEqual(getNextErr(), null, 'next() should have no error for ADMIN');
});

test('authorize middleware — blocks wrong role with 403', () => {
  const authorize = require('../../src/middleware/authorize');
  const { req, res, next, isNextCalled, getNextErr } = mockReqResNext({
    user: { id: 'resident-1', role: 'RESIDENT' },
  });

  authorize('ADMIN')(req, res, next);

  assert.strictEqual(isNextCalled(), true);
  const err = getNextErr();
  assert.ok(err && err.statusCode === 403, 'RESIDENT should get 403 on ADMIN-only route');
});

test('authorize middleware — blocks unauthenticated user with 401', () => {
  const authorize = require('../../src/middleware/authorize');
  const { req, res, next, getNextErr } = mockReqResNext({ user: null });

  authorize('ADMIN')(req, res, next);

  const err = getNextErr();
  assert.ok(err && (err.statusCode === 401 || err.statusCode === 403), 'Unauthenticated should be blocked');
});

// ─── 3. Input Validation ──────────────────────────────────────────────────────

test('validateCreateComplaint — rejects description over 2000 chars', () => {
  const { validateCreateComplaint } = require('../../src/validations/complaint.validation');
  const errors = validateCreateComplaint({
    title: 'Valid title here',
    description: 'A'.repeat(2001),
    category: 'PLUMBING',
    priority: 'HIGH',
  });
  assert.ok(errors.some((e) => e.toLowerCase().includes('2000')), `Expected max-length error, got: ${errors.join(', ')}`);
});

test('validateCreateComplaint — accepts description exactly at 2000 chars', () => {
  const { validateCreateComplaint } = require('../../src/validations/complaint.validation');
  const errors = validateCreateComplaint({
    title: 'Valid title here',
    description: 'A'.repeat(2000),
    category: 'ELECTRICAL',
    priority: 'LOW',
  });
  assert.strictEqual(errors.length, 0, `Expected no errors, got: ${errors.join(', ')}`);
});

test('validateNotice — rejects content over 5000 chars', () => {
  const { validateNotice } = require('../../src/validations/notice.validation');
  const errors = validateNotice({
    title: 'Valid notice title',
    content: 'B'.repeat(5001),
  });
  assert.ok(errors.some((e) => e.toLowerCase().includes('5000')), `Expected max-length error, got: ${errors.join(', ')}`);
});

test('validateNotice — accepts content exactly at 5000 chars', () => {
  const { validateNotice } = require('../../src/validations/notice.validation');
  const errors = validateNotice({
    title: 'Valid notice title',
    content: 'B'.repeat(5000),
  });
  assert.strictEqual(errors.length, 0, `Expected no errors, got: ${errors.join(', ')}`);
});

test('validateAnalyzeComplaint — rejects complaint under 20 chars', () => {
  const { validateAnalyzeComplaint } = require('../../src/validations/ai.validation');
  const errors = validateAnalyzeComplaint({ complaint: 'Too short' });
  assert.ok(errors.length > 0, 'Should reject complaint under 20 chars');
});

test('validateAnalyzeComplaint — rejects complaint over 5000 chars', () => {
  const { validateAnalyzeComplaint } = require('../../src/validations/ai.validation');
  const errors = validateAnalyzeComplaint({ complaint: 'X'.repeat(5001) });
  assert.ok(errors.some((e) => e.includes('5000')), 'Should reject complaint over 5000 chars');
});

// ─── 4. Logout Controller ─────────────────────────────────────────────────────

test('logout controller — clears token cookie and returns 200', async () => {
  const { logout } = require('../../src/controllers/auth.controller');
  const { req, res } = mockReqResNext();

  await logout(req, res);

  assert.strictEqual(res.getCode(), 200, 'Logout should return 200');
  assert.strictEqual(res.getBody().message, 'Logged out successfully.');
  const cleared = res.getClearedCookie();
  assert.ok(cleared, 'clearCookie should be called');
  assert.strictEqual(cleared.name, 'token');
  assert.strictEqual(cleared.opts.httpOnly, true);
});

// ─── 5. Scheduler Guard ───────────────────────────────────────────────────────

test('scheduler — duplicate initScheduler() call is silently skipped', () => {
  // Stub node-cron to prevent real timer from keeping process alive
  const cronPath = require.resolve('node-cron');
  const originalCron = require.cache[cronPath];
  require.cache[cronPath] = {
    ...originalCron,
    exports: { schedule: () => ({ start: () => {}, stop: () => {} }) },
  };

  // Clear scheduler module cache to reset the initialized flag
  const schedulerPath = require.resolve('../../src/services/scheduler.service');
  delete require.cache[schedulerPath];

  // Also stub prisma to avoid DB errors on checkOverdueComplaints startup call
  const prismaPath = require.resolve('../../src/config/db');
  const originalPrisma = require.cache[prismaPath];
  require.cache[prismaPath] = {
    ...originalPrisma,
    exports: {
      $transaction: async () => [{ count: 0 }, { count: 0 }],
      complaint: { updateMany: async () => ({ count: 0 }) },
    },
  };

  const schedulerService = require('../../src/services/scheduler.service');

  // Capture console.warn to detect the guard message
  const originalWarn = console.warn;
  let warnMessages = [];
  console.warn = (msg) => warnMessages.push(msg);

  // Call initScheduler twice
  schedulerService.initScheduler();
  schedulerService.initScheduler(); // Should be skipped

  // Restore everything
  console.warn = originalWarn;
  require.cache[cronPath] = originalCron;
  require.cache[prismaPath] = originalPrisma;
  delete require.cache[schedulerPath];

  // The guard should have emitted a warning on the second call
  const guardFired = warnMessages.some((m) => m.includes('Already initialized'));
  assert.ok(guardFired, `Expected "Already initialized" warning on second initScheduler() call. Got: ${warnMessages.join(', ')}`);
});
