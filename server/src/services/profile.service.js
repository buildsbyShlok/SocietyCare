const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
async function profileRecord(id, viewer) {
  if (viewer.id !== id && viewer.role !== 'ADMIN')
    throw new ApiError(403, 'This profile is private.');
  const record = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      flatNumber: true,
      tower: true,
      email: true,
      phone: true,
      avatarUrl: true,
      createdAt: true,
      role: true,
      complaints: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, archivedAt: true, createdAt: true },
      },
      bills: {
        where: { payment: { isNot: null } },
        orderBy: { month: 'desc' },
        select: {
          id: true,
          month: true,
          amount: true,
          payment: { select: { id: true, paidAt: true, reference: true } },
        },
      },
    },
  });
  if (!record) throw new ApiError(404, 'Resident record not found.');
  return record;
}
module.exports = { profileRecord };
