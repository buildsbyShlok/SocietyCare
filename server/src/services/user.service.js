const { uploadImage } = require('./image.service');
const { societyScope } = require('../utils/society-scope');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');

/**
 * Lists all users with optional query filters.
 *
 * @param {object} params
 * @param {string} [params.search]
 * @returns {Promise<object[]>}
 */
async function listUsers({ search }, actor) {
  const where = societyScope(actor);

  if (search) {
    const cleanSearch = require('../utils/workspace').field(search, 'search', 100);
    where.OR = [
      { name: { contains: cleanSearch, mode: 'insensitive' } },
      { email: { contains: cleanSearch, mode: 'insensitive' } },
      { flatNumber: { contains: cleanSearch, mode: 'insensitive' } },
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      tower: true,
      disabled: true,
      enrollmentPending: true,
      role: true,
      flatNumber: true,
      phone: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
}

/**
 * Promotes or demotes a user's role.
 *
 * @param {string} targetUserId
 * @param {string} newRole
 * @param {string} currentUserId
 * @returns {Promise<object>}
 */

const selectedUser = {id:true,name:true,email:true,role:true,disabled:true,tower:true,flatNumber:true,phone:true,avatarUrl:true,createdAt:true};
async function changeAccount(targetUserId, currentUserId, change) {
  if(targetUserId===currentUserId) throw new ApiError(400,'You cannot change your own role or delete your own account.');
  return prisma.$transaction(async tx=>{
    // Serialize role changes and deletions across API instances; reload the actor after the lock.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(4839017)`;
    const actor=await tx.user.findUnique({where:{id:currentUserId},select:{id:true,role:true,disabled:true,societyId:true}});
    if(!actor || actor.disabled || actor.role!==ROLES.ADMIN) throw new ApiError(403,'An active administrator is required.');
    const target=await tx.user.findUnique({where:{id:targetUserId},select:{id:true,role:true,disabled:true,societyId:true}});
    if(!target || target.societyId !== societyScope(actor).societyId) throw new ApiError(404,'User not found.');
    if (change.approve) {
      const result = await tx.user.updateMany({
        where: { id: targetUserId, ...societyScope(actor), role: ROLES.RESIDENT, disabled: true, enrollmentPending: true },
        data: { enrollmentPending: false, disabled: false }
      });
      if (!result.count) throw new ApiError(409, 'This account has no pending enrollment request.');
      return { message: 'Resident enrollment approved.' };
    }
    if(target.disabled && !change.delete) throw new ApiError(409,'This account is deactivated.');
    if(change.role && change.role===target.role) throw new ApiError(400,'User already has this role.');
    if(!target.disabled && target.role===ROLES.ADMIN && (change.delete || change.role===ROLES.RESIDENT)) {
      const admins=await tx.user.count({where:{...societyScope(actor),role:ROLES.ADMIN,disabled:false}});
      if(admins<=1) throw new ApiError(409,'The final active administrator cannot be removed or demoted.');
    }
    if(change.delete) {
      // Nullable ON DELETE SET NULL relationships keep all retained history and audit rows intact.
      await tx.user.delete({where:{id:targetUserId}});
      return {id:targetUserId};
    }
    return tx.user.update({where:{id:targetUserId},data:change,select:selectedUser});
  });
}
async function updateUserRole(targetUserId,newRole,currentUserId) {
  if(!Object.values(ROLES).includes(newRole)) throw new ApiError(400,'Invalid role assignment.');
  return changeAccount(targetUserId,currentUserId,{role:newRole});
}
async function deleteUser(targetUserId,currentUserId) {
  return changeAccount(targetUserId,currentUserId,{delete:true});
}


/**
 * Updates the user's profile details and upload optional avatar.
 *
 * @param {string} userId
 * @param {object} updates
 * @param {string} [updates.name]
 * @param {string} [updates.phone]
 * @param {string} [updates.flatNumber]
 * @param {object} [avatarFile] Multer file, including validated MIME type
 * @returns {Promise<object>}
 */
async function updateUserProfile(userId, { name, phone, flatNumber, tower }, avatarFile) {
  const data = {};
  const { field } = require('../utils/workspace');
  if (tower !== undefined) data.tower = field(tower,'tower',60,true) || null;
  if (name !== undefined) field(name,'name',100);
  if (phone !== undefined) field(phone,'phone',30,true);
  if (flatNumber !== undefined) field(flatNumber,'flat number',40);

  if (name !== undefined) {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      throw new ApiError(400, 'Name must be at least 2 characters.');
    }
    data.name = cleanName;
  }

  if (phone !== undefined) {
    data.phone = phone ? phone.trim() : null;
  }

  if (flatNumber !== undefined) {
    const cleanFlat = flatNumber.trim();
    if (cleanFlat.length === 0) {
      throw new ApiError(400, 'Flat number is required.');
    }
    data.flatNumber = cleanFlat;
  }

  if (avatarFile) {
    const image = await uploadImage(avatarFile, 'avatars');
    data.avatarUrl = image.url;
    data.avatarPublicId = image.publicId;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      tower: true,
      id: true,
      name: true,
      email: true,
      role: true,
      flatNumber: true,
      phone: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  return updated;
}

module.exports = {
  approveEnrollment: (target, actor) => changeAccount(target, actor, { approve: true }),
  listUsers,
  updateUserRole,
  deleteUser,
  updateUserProfile,
};
