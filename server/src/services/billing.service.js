const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { field, dateOnly } = require('../utils/workspace');
const include = {
  payment: { select: { id: true, reference: true, paidAt: true } },
  resident: { select: { name: true } },
};

function invoice(
  row,
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
) {
  const due = row.dueDate.toISOString().slice(0, 10);
  return {
    ...row,
    dueDate: due,
    status: row.payment ? 'PAID' : due < today ? 'OVERDUE' : 'PENDING',
  };
}
async function listBills(user) {
  const rows = await prisma.bill.findMany({
    where: user.role === 'ADMIN' ? {} : { residentId: user.id },
    include,
    orderBy: [{ month: 'desc' }, { flatNumber: 'asc' }],
  });
  return { items: rows.map((row) => invoice(row)) };
}
async function issueBill(body) {
  const month = field(body.month, 'billing month', 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new ApiError(400, 'Choose a valid billing month.');
  if (!['string', 'number'].includes(typeof body.amount))
    throw new ApiError(400, 'Enter a valid amount.');
  const amount = String(body.amount);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
    throw new ApiError(400, 'Enter a positive charge with up to two decimal places.');
  const dueDate = dateOnly(body.dueDate);
  const resident = await prisma.user.findUnique({
    where: { id: field(body.residentId, 'resident', 80) },
    select: { id: true, role: true, disabled: true, flatNumber: true, tower: true },
  });
  if (!resident || resident.disabled || resident.role !== 'RESIDENT')
    throw new ApiError(400, 'Select an active resident.');
  try {
    const row = await prisma.bill.create({
      data: {
        residentId: resident.id,
        tower: (resident.tower || '').trim().toUpperCase(),
        flatNumber: resident.flatNumber.trim().toUpperCase(),
        month,
        amount,
        dueDate,
      },
      include,
    });
    return invoice(row);
  } catch (error) {
    if (error.code === 'P2002')
      throw new ApiError(409, 'This unit already has an invoice for that month.');
    throw error;
  }
}
async function verifyPayment(id, body, verifier) {
  const reference = field(body.reference, 'payment reference', 100).toUpperCase();
  try {
    return await prisma.payment.create({
      data: { billId: id, reference, verifiedById: verifier.id },
      select: { id: true, paidAt: true, reference: true },
    });
  } catch (error) {
    if (error.code === 'P2002')
      throw new ApiError(409, 'This invoice or payment reference has already been verified.');
    if (error.code === 'P2003') throw new ApiError(404, 'Invoice not found.');
    throw error;
  }
}
module.exports = { listBills, issueBill, verifyPayment, invoice };
