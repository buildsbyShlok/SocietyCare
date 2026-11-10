const userService = require('../services/user.service');
const ApiError = require('../utils/ApiError');

/**
 * Handles GET /api/users
 * Returns list of users based on search filter.
 */
async function list(req, res, next) {
  try {
    const { search } = req.query;
    const users = await userService.listUsers({ search });
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /api/users/:id/role
 * Promotes/demotes user roles.
 */
async function updateRole(req, res, next) {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;
    const currentUserId = req.user.id;

    if (!role) {
      throw new ApiError(400, 'role field is required.');
    }

    const updatedUser = await userService.updateUserRole(targetUserId, role, currentUserId);

    res.status(200).json({
      success: true,
      message: `User successfully ${role === 'ADMIN' ? 'promoted to admin' : 'demoted to resident'}.`,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /api/users/profile
 * Updates own profile (name, phone, flatNumber, avatar picture).
 */
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, phone, flatNumber, tower } = req.body;

    const updatedUser = await userService.updateUserProfile(
      userId,
      { name, phone, flatNumber, tower },
      req.file
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req,res,next) {
  try {
    const data=await userService.deleteUser(req.params.id,req.user.id);
    res.status(200).json({success:true,message:'Account permanently deleted. Login and profile data were removed; financial, community and audit records were retained without the account link.',data});
  } catch(error) {next(error);}
}
module.exports = {
  list,
  updateRole,
  deleteUser,
  updateProfile,
};
