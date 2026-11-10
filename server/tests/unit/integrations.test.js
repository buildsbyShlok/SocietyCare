const test = require('node:test');
const assert = require('node:assert/strict');
const cloudinary = require('../../src/config/cloudinary');
const { createComplaint } = require('../../src/services/complaint.service');
const { updateUserProfile } = require('../../src/services/user.service');

test('Missing Cloudinary credentials return actionable 503 before writing data', async (t) => {
  const config = { ...cloudinary.config() };
  t.after(() => cloudinary.config(config));
  cloudinary.config({ cloud_name: '', api_key: '', api_secret: '' });
  const unavailable = (error) => error.statusCode === 503 && error.message.includes('Cloudinary is not configured');
  await assert.rejects(createComplaint({ title: 'QA issue', description: 'QA description', category: 'OTHER', priority: 'LOW' }, 'resident', require('../fixtures/image')), unavailable);
  await assert.rejects(updateUserProfile('resident', {}, require('../fixtures/image')), unavailable);
});

test('Resend missing sender skips delivery and returned service errors are detected', async (t) => {
  const resendPath = require.resolve('resend');
  const emailPath = require.resolve('../../src/services/email.service');
  const originalResend = require.cache[resendPath];
  const originalEmail = require.cache[emailPath];
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  let calls = 0;
  require.cache[resendPath] = { exports: { Resend: class {
    emails = { send: async () => { calls++; return { error: { message: 'Sender rejected' } }; } };
  } } };
  t.after(() => {
    require.cache[resendPath] = originalResend;
    require.cache[emailPath] = originalEmail;
    if (key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = key;
    if (from === undefined) delete process.env.FROM_EMAIL; else process.env.FROM_EMAIL = from;
  });
  process.env.RESEND_API_KEY = 'test-only';
  delete process.env.FROM_EMAIL;
  delete require.cache[emailPath];
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(message));
  await require(emailPath).sendStatusUpdateEmail({}, {}, 'OPEN');
  assert.equal(calls, 0);
  assert.match(warnings[0], /FROM_EMAIL/);

  process.env.FROM_EMAIL = 'qa@example.test';
  delete require.cache[emailPath];
  const service = require(emailPath);
  await assert.rejects(service.sendStatusUpdateEmail({ email: 'qa@example.test' }, { id: 'qa', title: 'QA' }, 'OPEN'), /Email delivery failed/);
  const errors = [];
  t.mock.method(console, 'error', (message) => errors.push(message));
  await service.sendNoticeEmail([{ email: 'qa@example.test' }], { title: 'QA', content: 'QA' });
  assert.match(errors[0], /1\/1 notice emails failed/);
});
