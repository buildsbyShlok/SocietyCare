const prisma = require('../config/db');
const { getDashboardStats } = require('../services/dashboard.service');

/**
 * Dashboard Controller
 *
 * Returns role-scoped statistics via a single endpoint.
 * The service determines the response shape based on req.user.role:
 *
 *   RESIDENT — { role, totalComplaints, byStatus }
 *   ADMIN    — { role, totalComplaints, byStatus, byCategory, overdueCount }
 */
async function getDashboard(req, res, next) {
  try {
    const stats = await getDashboardStats(req.user);
    const balance = await prisma.bill.aggregate({ where: { payment: null, ...(req.user.role === 'ADMIN' ? {} : { residentId: req.user.id }) }, _sum: { amount: true } });
    res.status(200).json({ ...stats, outstanding: balance._sum.amount || 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
