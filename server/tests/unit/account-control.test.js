const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/config/db');
const { updateUserRole, deleteUser } = require('../../src/services/user.service');

test('Account controls reauthorize under lock and preserve the final admin', async t => {
  const originals = {transaction:prisma.$transaction, raw:prisma.$queryRaw, find:prisma.user.findUnique, count:prisma.user.count, remove:prisma.user.delete, update:prisma.user.update};
  t.after(()=> {
    prisma.$transaction=originals.transaction; prisma.$queryRaw=originals.raw;
    prisma.user.findUnique=originals.find; prisma.user.count=originals.count; prisma.user.update=originals.update; prisma.user.delete=originals.remove;
  });
  const accounts = new Map();
  let writes=0, lockHeld=false, forcedCount=null, beforeLock;
  const reset=()=>{
    accounts.clear();
    accounts.set('actor',{id:'actor',role:'ADMIN',disabled:false});
    accounts.set('target',{id:'target',role:'RESIDENT',disabled:false});
    writes=0; forcedCount=null; beforeLock=null;
  };
  prisma.$transaction=async work=> {try {return await work(prisma);}finally {lockHeld=false;}};
  prisma.$queryRaw=async (parts)=>{
    assert.match(parts.join(''),/pg_advisory_xact_lock/);
    if(beforeLock) beforeLock();
    lockHeld=true;
    return [{locked:1}];
  };
  prisma.user.findUnique=async ({where})=>{assert.equal(lockHeld,true,'account is loaded after acquiring the lock');return accounts.get(where.id)||null;};
  prisma.user.count=async ({where})=>{
    assert.deepEqual(where,{role:'ADMIN',disabled:false});
    return forcedCount ?? [...accounts.values()].filter(u=>u.role==='ADMIN'&&!u.disabled).length;
  };
  prisma.user.update=async ({where,data})=>{writes++;Object.assign(accounts.get(where.id),data);return accounts.get(where.id);};
  prisma.user.delete=async ({where})=>{writes++; const row=accounts.get(where.id); accounts.delete(where.id); return row;};
  await t.test('resident, missing and disabled actors cannot change roles or delete',async()=>{
    for(const role of ['RESIDENT','DISABLED','MISSING']) {
      reset();
      if(role==='MISSING')accounts.delete('actor');
      else if(role==='DISABLED')accounts.get('actor').disabled=true;
      else accounts.get('actor').role=role;
      await assert.rejects(updateUserRole('target','ADMIN','actor'),{statusCode:403});
      await assert.rejects(deleteUser('target','actor'),{statusCode:403});
      assert.equal(writes,0);
    }
  });
  await t.test('actor demoted while waiting for lock loses authority',async()=>{
    reset(); beforeLock=()=>{accounts.get('actor').role='RESIDENT';};
    await assert.rejects(updateUserRole('target','ADMIN','actor'),{statusCode:403});
    assert.equal(writes,0);
  });
  await t.test('self-change and self-deletion are forbidden including sole admin',async()=>{
    reset();
    await assert.rejects(updateUserRole('actor','RESIDENT','actor'),{statusCode:400});
    await assert.rejects(deleteUser('actor','actor'),{statusCode:400});
    assert.equal(writes,0);
  });
  await t.test('final-admin count blocks both demotion and deletion',async()=>{
    reset(); accounts.get('target').role='ADMIN'; forcedCount=1;
    await assert.rejects(updateUserRole('target','RESIDENT','actor'),{statusCode:409});
    await assert.rejects(deleteUser('target','actor'),{statusCode:409});
    assert.equal(writes,0);
  });
  await t.test('eligible roles change and deletion permanently removes the account',async()=>{
    reset();
    await updateUserRole('target','ADMIN','actor');
    assert.equal(accounts.get('target').role,'ADMIN');
    await updateUserRole('target','RESIDENT','actor');
    assert.equal(accounts.get('target').role,'RESIDENT');
    await deleteUser('target','actor');
    assert.equal(accounts.has('target'),false);
    assert.equal(accounts.size,1);
    await assert.rejects(updateUserRole('target','ADMIN','actor'),{statusCode:404});
    await assert.rejects(deleteUser('target','actor'),{statusCode:404});
    assert.equal(writes,3);
  });
  await t.test('an eligible second admin can be deleted',async()=>{
    reset(); accounts.get('target').role='ADMIN';
    await deleteUser('target','actor');
    assert.equal(accounts.has('target'),false);
    assert.equal(accounts.get('actor').disabled,false);
  });
  await t.test('invalid roles and missing targets fail closed',async()=>{
    reset();
    await assert.rejects(updateUserRole('target','SUPERADMIN','actor'),{statusCode:400});
    await assert.rejects(deleteUser('missing','actor'),{statusCode:404});
    assert.equal(writes,0);
  });
});
