/**
 * ai.routes.js — Routes for the AI complaint analysis feature.
 *
 * SocietyCare retains only two AI endpoints:
 *   1. POST /analyze-complaint  — AI-assisted complaint structuring (required)
 *   2. POST /detect-duplicates  — Duplicate detection before submission (optional)
 *
 * Removed endpoints (out of scope for SocietyCare v1):
 *   - POST /parse-search
 *   - GET  /operations-insights
 *   - POST /generate-text
 *
 * All routes require authentication (residents and admins).
 */

const { Router } = require('express');
const {
  analyzeComplaintHandler,
  detectDuplicatesHandler,
} = require('../controllers/ai.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  validateAnalyzeComplaint,
  validateDetectDuplicates,
} = require('../validations/ai.validation');

const router = Router();

// All AI routes require a valid JWT
router.use(authenticate);
router.use(require('express-rate-limit')({
  windowMs: 60000, limit: 12,
  keyGenerator: req => req.user.id,
  standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many AI requests. Wait a minute or submit manually.' },
}));

/**
 * POST /api/ai/analyze-complaint
 * Suggests title, category, priority and an improved description.
 * Returns a structured AI result; fails gracefully when GROQ_API_KEY is absent.
 */
router.post('/analyze-complaint', validate(validateAnalyzeComplaint), analyzeComplaintHandler);

/**
 * POST /api/ai/detect-duplicates
 * Compares complaint text against recent unresolved complaints.
 */
router.post('/detect-duplicates', validate(validateDetectDuplicates), detectDuplicatesHandler);

module.exports = router;
