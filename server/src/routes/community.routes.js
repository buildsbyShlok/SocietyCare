const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const authenticate = require("../middleware/authenticate");
const admin = require("../middleware/authorize")("ADMIN");
const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
const { endpoint, field } = require("../utils/workspace");
const { upload } = require("../middleware/upload");
const { uploadImage } = require("../services/image.service");
const publicFields = {
  senderId: true,
  imageUrl: true,
  replyTo: {
    select: {
      id: true,
      body: true,
      removedAt: true,
      sender: { select: { name: true } },
    },
  },
  id: true,
  body: true,
  createdAt: true,
  sender: {
    select: {
      name: true,
      flatNumber: true,
      tower: true,
      avatarUrl: true,
      role: true,
    },
  },
};
const visible = (m) => ({
  ...m,
  replyTo: m.replyTo?.removedAt
    ? { id: m.replyTo.id, unavailable: true }
    : m.replyTo,
});
router.use(authenticate);
const throttle = (limit, windowMs) =>
  rateLimit({
    limit,
    windowMs,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Please wait before posting again." },
  });
router.get(
  "/",
  endpoint(async ({ query }) => {
    const where = { removedAt: null };
    if (query.before) {
      const earlier = await prisma.communityMessage.findUnique({
        where: { id: field(query.before, "message cursor", 80) },
        select: { createdAt: true, id: true },
      });
      if (!earlier) throw new ApiError(400, "Unknown message cursor.");
      where.OR = [
        { createdAt: { lt: earlier.createdAt } },
        { createdAt: earlier.createdAt, id: { lt: earlier.id } },
      ];
    }
    const rows = await prisma.communityMessage.findMany({
      where,
      select: publicFields,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    return {
      items: rows.slice(0, 50).reverse().map(visible),
      hasEarlier: rows.length > 50,
    };
  }),
);
router.post(
  "/",
  throttle(8, 60000),
  upload.single("image"),
  endpoint(async ({ user, body, file }) => {
    const text = field(body.body, "message", 1000, Boolean(file));
    const replyToId =
      field(body.replyToId, "reply message", 80, true) || undefined;
    if (
      replyToId &&
      !(await prisma.communityMessage.findFirst({
        where: { id: replyToId, removedAt: null },
        select: { id: true },
      }))
    )
      throw new ApiError(
        404,
        "The message you are replying to is no longer available.",
      );
    const image = await uploadImage(file, "community");
    return visible(
      await prisma.communityMessage.create({
        data: { senderId: user.id, body: text, imageUrl: image?.url, imagePublicId: image?.publicId, replyToId },
        select: publicFields,
      }),
    );
  }, 201),
);
router.post(
  "/:id/report",
  throttle(8, 600000),
  endpoint(async ({ params, body, user }) => {
    const reason = field(body.reason, "report reason", 240);
    const message = await prisma.communityMessage.findFirst({
      where: { id: params.id, removedAt: null },
      select: { id: true },
    });
    if (!message) throw new ApiError(404, "Message unavailable.");
    try {
      await prisma.messageReport.create({
        data: { messageId: params.id, reporterId: user.id, reason },
      });
    } catch (error) {
      if (error.code === "P2002")
        throw new ApiError(409, "You already reported this message.");
      throw error;
    }
    return { message: "Report sent to moderators." };
  }, 201),
);
router.get(
  "/reports",
  admin,
  endpoint(async () => ({
    items: (
      await prisma.communityMessage.findMany({
        where: { removedAt: null, reports: { some: {} } },
        select: {
          ...publicFields,
          reports: { select: { reason: true, createdAt: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      })
    ).map(visible),
  })),
);
router.delete(
  "/:id",
  admin,
  endpoint(async ({ params, user }) => {
    const { count } = await prisma.communityMessage.updateMany({
      where: { id: params.id, removedAt: null },
      data: { removedAt: new Date(), removedById: user.id },
    });
    if (!count) throw new ApiError(404, "Message unavailable.");
    return { message: "Message removed from the community." };
  }),
);
module.exports = router;
