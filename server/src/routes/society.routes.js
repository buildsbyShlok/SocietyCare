const router = require('express').Router();
const prisma = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { endpoint, field, dateOnly } = require('../utils/workspace');
const ApiError = require('../utils/ApiError');

router.use(authenticate);
router.get(
  '/',
  endpoint(async () => {
    const [society, units] = await Promise.all([
      prisma.society.findUnique({ where: { id: 1 } }),
      prisma.user.findMany({
        where: { role: 'RESIDENT', disabled: false },
        distinct: ['tower', 'flatNumber'],
        select: { flatNumber: true, tower: true },
      }),
    ]);
    return {
      society,
      registeredFlats: units.length,
      towers: [...new Set(units.map((u) => u.tower).filter(Boolean))].sort(),
    };
  }),
);
router.patch(
  '/',
  authorize('ADMIN'),
  endpoint(async ({ body }) => {
    if (
      ![undefined, null, ''].includes(body.totalFlats) &&
      !['number', 'string'].includes(typeof body.totalFlats)
    )
      throw new ApiError(400, 'Enter a valid flat count.');
    const totalFlats =
      body.totalFlats === '' || body.totalFlats == null ? null : Number(body.totalFlats);
    if (
      totalFlats !== null &&
      (!Number.isSafeInteger(totalFlats) || totalFlats < 1 || totalFlats > 1000000)
    )
      throw new ApiError(400, 'Total flats must be between 1 and 1,000,000.');
    const data = {
      name: field(body.name, 'society name', 100),
      address: field(body.address, 'address', 240, true),
      description: field(body.description, 'description', 800, true),
      totalFlats,
      upcomingMaintenance:
        field(body.upcomingMaintenance, 'maintenance information', 500, true) || null,
      maintenanceDate: body.maintenanceDate ? dateOnly(body.maintenanceDate) : null,
    };
    return prisma.society.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  }),
);
module.exports = router;
