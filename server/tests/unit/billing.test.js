const test = require('node:test');
const assert = require('node:assert/strict');
const { invoice, issueBill } = require('../../src/services/billing.service');
test('invoice due date is inclusive and a verified payment overrides overdue', () => {
  const bill = { dueDate: new Date('2026-11-04T00:00:00Z'), payment: null };
  assert.equal(invoice(bill, '2026-11-04').status, 'PENDING');
  assert.equal(invoice(bill, '2026-11-05').status, 'OVERDUE');
  assert.equal(invoice({ ...bill, payment: { id: 'receipt' } }, '2026-11-05').status, 'PAID');
});
test('billing rejects invalid amounts, periods and impossible dates before database access', async () => {
  const bill = { month: '2026-11', dueDate: '2026-11-04', amount: '10' };
  for (const invalid of [
    { amount: '1.234' },
    { amount: 0 },
    { month: '2026-13' },
    { dueDate: '2026-02-30' },
  ])
    await assert.rejects(issueBill({ ...bill, ...invalid }), (error) => error.statusCode === 400);
});
