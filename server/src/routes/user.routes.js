const { endpoint } = require('../utils/workspace');
const {profileRecord} = require('../services/profile.service');
const { Router } = require('express');
const { list, updateRole, updateProfile, deleteUser } = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { uploadAvatar } = require('../middleware/upload');
const { ROLES } = require('../utils/constants');

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Profile update is available to all logged in users
router.patch('/profile', uploadAvatar.single('avatar'), updateProfile);

router.get('/:id/record', endpoint(req => profileRecord(req.params.id, req.user)));

// Admin-only routes
router.patch('/:id/enrollment', authorize(ROLES.ADMIN), endpoint(req =>
  require('../services/user.service').approveEnrollment(req.params.id, req.user.id)));
router.get('/', authorize(ROLES.ADMIN), list);
router.patch('/:id/role', authorize(ROLES.ADMIN), updateRole);
router.delete('/:id', authorize(ROLES.ADMIN), deleteUser);

module.exports = router;
