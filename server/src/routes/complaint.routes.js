const { Router } = require("express");
const {
  create,
  list,
  getById,
  updateStatus,
} = require("../controllers/complaint.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { upload } = require("../middleware/upload");
const validate = require("../middleware/validate");
const {
  validateCreateComplaint,
  validateUpdateStatus,
} = require("../validations/complaint.validation");
const { ROLES } = require("../utils/constants");

const router = Router();
const qrSubmissionLimit = require('express-rate-limit')({
  windowMs: 10 * 60 * 1000, limit: 10, keyGenerator: req => req.user.id,
  standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many QR reports. Please wait a few minutes before submitting another.' },
});

// All complaint routes require authentication
router.use(authenticate);

router.post(
  "/",
  authorize(ROLES.RESIDENT),
  upload.single("photo"),
  (req, res, next) => req.body?.qrToken !== undefined ? qrSubmissionLimit(req, res, next) : next(),
  validate(validateCreateComplaint),
  create,
);
router.get("/", list);
router.get("/:id", getById);
router.patch(
  "/:id/status",
  authorize(ROLES.ADMIN),
  validate(validateUpdateStatus),
  updateStatus,
);

const {endpoint}=require("../utils/workspace");
const {archiveComplaint,deleteArchivedComplaint}=require("../services/complaint-lifecycle.service");
router.post("/:id/archive",authorize(ROLES.ADMIN,ROLES.RESIDENT),endpoint(req=>archiveComplaint(req.params.id,req.body,req.user)));
router.delete("/:id",authorize(ROLES.ADMIN,ROLES.RESIDENT),endpoint(req=>deleteArchivedComplaint(req.params.id,req.user)));
module.exports=router;
