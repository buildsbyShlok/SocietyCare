const router = require("express").Router();
const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
const { endpoint, field, dateOnly } = require("../utils/workspace");
const { upload } = require("../middleware/upload");
const { uploadImage } = require("../services/image.service");
const rateLimit = require("express-rate-limit");
const select = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  location: true,
  imageUrl: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { name: true, flatNumber: true, tower: true } },
};
router.use(require("../middleware/authenticate"));
function eventData(body) {
  const startsAt = field(body.startsAt, "event date and time", 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(startsAt) ||
    isNaN(new Date(startsAt))
  )
    throw new ApiError(400, "Enter a valid event date and time.");
  dateOnly(startsAt.slice(0, 10));
  if (new Date(startsAt).toISOString().slice(0, 19) !== startsAt.slice(0, 19))
    throw new ApiError(400, "Enter a valid event date and time.");
  return {
    title: field(body.title, "title", 150),
    description: field(body.description, "description", 5000),
    location: field(body.location, "location", 240),
    startsAt: new Date(startsAt),
  };
}
async function existing(id, user) {
  const event = await prisma.event.findFirst({
    where: { id, removedAt: null },
    select,
  });
  if (!event) throw new ApiError(404, "Event not found.");
  if (user && user.role !== "ADMIN" && event.creatorId !== user.id)
    throw new ApiError(
      403,
      "Only the event creator or an admin can manage this event.",
    );
  return event;
}
const throttle = rateLimit({
  windowMs: 3600000,
  limit: 30,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before making more event changes." },
});
router.get(
  "/",
  endpoint(async ({ query }) => {
    const page = Math.max(1, Math.min(10000, parseInt(query.page, 10) || 1)),
      limit = Math.max(1, Math.min(50, parseInt(query.limit, 10) || 12));
    const where = {
      removedAt: null,
      ...(query.upcoming === "true" ? { startsAt: { gte: new Date() } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.event.findMany({
        where,
        select,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);
    return { items, page, hasNext: page * limit < total };
  }),
);
router.get(
  "/:id",
  endpoint((req) => existing(req.params.id)),
);
router.post(
  "/",
  throttle,
  upload.single("image"),
  endpoint(async (req) => {
    const data = eventData(req.body);
    const image = await uploadImage(req.file, "events");
    if (image) Object.assign(data, { imageUrl: image.url, imagePublicId: image.publicId });
    return prisma.event.create({
      data: { ...data, creatorId: req.user.id },
      select,
    });
  }, 201),
);
router.patch(
  "/:id",
  throttle,
  async (req, res, next) => {
    try {
      await existing(req.params.id, req.user);
      next();
    } catch (e) {
      next(e);
    }
  },
  upload.single("image"),
  endpoint(async (req) => {
    const data = eventData(req.body);
    if (
      req.body.removeImage !== undefined &&
      ![true, false, "true", "false"].includes(req.body.removeImage)
    )
      throw new ApiError(400, "Invalid image removal setting.");
    if (req.file) {
      const image = await uploadImage(req.file, "events");
      Object.assign(data, { imageUrl: image.url, imagePublicId: image.publicId });
    }
    else if (req.body.removeImage === true || req.body.removeImage === "true")
      Object.assign(data, { imageUrl: null, imagePublicId: null });
    return prisma.event.update({
      where: { id: req.params.id, removedAt: null },
      data,
      select,
    });
  }),
);
router.delete(
  "/:id",
  throttle,
  endpoint(async (req) => {
    await existing(req.params.id, req.user);
    await prisma.event.update({
      where: { id: req.params.id },
      data: { removedAt: new Date() },
    });
    return { message: "Event removed from the calendar." };
  }),
);
module.exports = router;
module.exports.eventData = eventData;
