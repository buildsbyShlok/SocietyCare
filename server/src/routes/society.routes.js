const router = require('express').Router();
const prisma = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { endpoint, field } = require('../utils/workspace');
const ApiError = require('../utils/ApiError');

router.use(authenticate);
router.get(
  '/',
  endpoint(async ({ user }) => {
    const [society, units] = await Promise.all([
      prisma.society.findUnique({ where: { id: user.societyId } }),
      prisma.user.findMany({
        where: { societyId: user.societyId, role: 'RESIDENT', disabled: false },
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
  endpoint(async ({ body, user }) => {
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
    };
    return prisma.society.upsert({ where: { id: user.societyId }, update: data, create: { id: user.societyId, ...data } });
  }),
);
module.exports = router;
