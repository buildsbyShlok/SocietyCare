const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../../src/config/db');
const aiService = require('../../src/services/ai.service');
const ApiError = require('../../src/utils/ApiError');

/**
 * AI Service Unit Tests
 *
 * SocietyCare Phase 2: Only analyzeComplaint and detectDuplicates are active.
 * Tests for removed functions (parseSearchIntent, generateOperationsInsights,
 * generateText) have been removed to match the scope reduction.
 */

// Back up original keys and functions
const originalApiKey = process.env.GROQ_API_KEY;
const originalComplaintFindMany = prisma.complaint.findMany;
const originalFetch = global.fetch;

test.afterEach(() => {
  process.env.GROQ_API_KEY = originalApiKey;
  prisma.complaint.findMany = originalComplaintFindMany;
  global.fetch = originalFetch;
});

test('Unit Tests — AI Service (analyzeComplaint & detectDuplicates)', async (t) => {

  await t.test('detectDuplicates — should return early with empty array if database has no unresolved complaints', async () => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    prisma.complaint.findMany = async () => [];

    const matches = await aiService.detectDuplicates('New dripping faucet leak.', { id: 'test-admin', role: 'ADMIN', societyId: 1 });
    assert.deepStrictEqual(matches, []);
  });

  await t.test('detectDuplicates — should format list and parse Groq JSON response matches correctly', async () => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    
    const mockUnresolved = [
      { id: '1', title: 'Water leak', description: 'Leaking basin.', status: 'OPEN', priority: 'LOW', createdAt: new Date() },
    ];
    prisma.complaint.findMany = async () => mockUnresolved;

    // Stub global fetch to simulate Groq response
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              matches: [{ complaintId: '1', similarity: 90, reason: 'Both are plumbing leaks.' }]
            })
          }
        }]
      })
    });

    const matches = await aiService.detectDuplicates('Dripping pipe behind basin.', { id: 'test-admin', role: 'ADMIN', societyId: 1 });
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].complaintId, '1');
    assert.strictEqual(matches[0].similarity, 90);
  });

  await t.test('analyzeComplaint — should throw 503 when GROQ_API_KEY is not configured', async () => {
    delete process.env.GROQ_API_KEY;

    await assert.rejects(
      async () => { await aiService.analyzeComplaint('Water leaking from the bathroom ceiling pipe.'); },
      (err) => err instanceof ApiError && err.statusCode === 503
    );
  });

  await t.test('detectDuplicates — should throw 503 when GROQ_API_KEY is not configured', async () => {
    delete process.env.GROQ_API_KEY;

    await assert.rejects(
      async () => { await aiService.detectDuplicates('Water leak', { id: 'test-admin', role: 'ADMIN', societyId: 1 }); },
      (err) => err instanceof ApiError && err.statusCode === 503
    );
  });

  await t.test('parseAndValidate — should reject malformed LLM JSON with ApiError 422', () => {
    assert.throws(
      () => aiService.parseAndValidate('this is not json {{{{'),
      (err) => err instanceof ApiError && err.statusCode === 422
    );
  });

  await t.test('parseAndValidate — should normalise category and priority to uppercase', () => {
    const raw = JSON.stringify({
      title: 'Water leak in flat',
      category: 'plumbing',
      priority: 'high',
      refinedDescription: 'Water leaking from pipe.',
      summary: 'Plumbing issue',
      reasoning: 'Pipe issue',
      confidence: 85,
    });
    const result = aiService.parseAndValidate(raw);
    assert.strictEqual(result.category, 'PLUMBING');
    assert.strictEqual(result.priority, 'HIGH');
    assert.strictEqual(result.confidence, 85);
  });

  await t.test('parseAndValidate — should reject unknown category with ApiError 422', () => {
    const raw = JSON.stringify({
      title: 'Some issue',
      category: 'UNKNOWN_CATEGORY',
      priority: 'LOW',
      summary: 'x',
      reasoning: 'x',
      confidence: 50,
    });
    assert.throws(
      () => aiService.parseAndValidate(raw),
      (err) => err instanceof ApiError && err.statusCode === 422
    );
  });

});
