const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { field } = require('../utils/workspace');
function ownerScope(user) { return user.role === 'ADMIN' ? {} : {residentId:user.id}; }
async function ownedComplaint(id,user) {
  const complaint=await prisma.complaint.findUnique({where:{id},select:{residentId:true,archivedAt:true,deletedAt:true}});
  if(!complaint || complaint.deletedAt) throw new ApiError(404,'Complaint not found.');
  if(user.role!=='ADMIN' && complaint.residentId!==user.id) throw new ApiError(403,'You can only manage your own complaints.');
  return complaint;
}
async function archiveComplaint(id,body,user) {
  const reason=field(body.reason,'archive reason',500);
  await ownedComplaint(id,user);
  const result=await prisma.complaint.updateMany({
    where:{id,archivedAt:null,deletedAt:null,...ownerScope(user)},
    data:{archivedAt:new Date(),archivedById:user.id,archiveReason:reason,isOverdue:false}
  });
  if(!result.count) throw new ApiError(409,'Complaint is already archived. Refresh to see its current state.');
  return {message:'Complaint archived.'};
}
async function deleteArchivedComplaint(id,user) {
  const complaint=await ownedComplaint(id,user);
  if(!complaint.archivedAt) throw new ApiError(409,'Archive this complaint before deleting it.');
  const result=await prisma.complaint.updateMany({
    where:{id,archivedAt:{not:null},deletedAt:null,...ownerScope(user)},
    data:{deletedAt:new Date(),deletedById:user.id,isOverdue:false}
  });
  if(!result.count) throw new ApiError(409,'Complaint changed. Refresh before trying again.');
  return {message:'Complaint removed from listings. Its record and audit history have been retained.'};
}
module.exports={archiveComplaint,deleteArchivedComplaint};
