const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {buildSync}=require('esbuild');
function load(file) {
  const filename=path.resolve(__dirname,'../'+file);
  const code=buildSync({entryPoints:[filename],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
  const mod=new Module(filename,module);mod.paths=module.paths;mod._compile(code,filename);return mod.exports;
}
async function run(){
  const {safeReportReturn,reportAuthPath}=load('src/utils/report-return.js');
  const report='/report/'+'q'.repeat(43)+'?from=label#issue';
  assert.equal(safeReportReturn(report),report);
  assert.equal(safeReportReturn('/report/asset/'+'q'.repeat(43)),'/report/asset/'+'q'.repeat(43));
  for(const value of [null,undefined,'https://evil.test','//evil.test','/\\evil.test','/report/short','/login','/report/'+'q'.repeat(43)+'/../login','/report/%2f%2fevil.test']) assert.equal(safeReportReturn(value),'/');
  const login=reportAuthPath('/login',report);assert.equal(new URLSearchParams(login.split('?')[1]).get('returnTo'),report);
  assert.equal(reportAuthPath('/register','https://evil.test'),'/register');
  console.log('PASS QR return destination preservation across login/register, legacy QR paths, and open-redirect rejection');
  // Directory actions are tested first, including the exact helpers invoked by its buttons.
  const {performResidentAction:act}=load('src/pages/resident-actions.js');
  let calls=[], confirmations=[];
  const account={id:'target',name:'Test Member',email:'member@example.test',role:'RESIDENT'};
  const api={updateRole:async(...args)=>{calls.push(['role',...args]);return{message:'Updated'};},delete:async(...args)=>{calls.push(['delete',...args]);return{message:'Deleted'};}};
  const base={account,currentUser:{id:'admin',role:'ADMIN'},token:'test',api,confirm:text=>{confirmations.push(text);return true;}};
  assert.equal(await act({...base,confirm:()=>false}),null);assert.equal(calls.length,0);
  await act({...base,role:'ADMIN'});await act({...base,role:'RESIDENT'});await act(base);
  assert.deepEqual(calls,[['role','target','ADMIN','test'],['role','target','RESIDENT','test'],['delete','target','test']]);
  assert.ok(confirmations.every(text=>text.includes(account.name)&&text.includes(account.email)));
  assert.match(confirmations[2],/Permanently delete/);assert.match(confirmations[2],/Financial records/);
  await assert.rejects(act({...base,currentUser:{id:'other',role:'RESIDENT'}}));
  await assert.rejects(act({...base,currentUser:{id:'target',role:'ADMIN'}}));
  await assert.rejects(act({...base,account:{...account,disabled:true},role:'ADMIN'}));
  await act({...base,account:{...account,disabled:true}});
  await assert.rejects(act({...base,api:{delete:async()=>{throw Error('Backend rejected deletion');}}}),/Backend rejected/);
  console.log('PASS directory handlers: promotion, demotion, deletion, cancellation, identity confirmation, self/resident denial, disabled-account deletion and API errors');

  const {createSocietyCamera,INITIAL_CAMERA}=load('src/components/society-camera.js');
  const writes=[];
  const c=createSocietyCamera(s=>writes.push(s));
  const pointer=(id,x,y,extra={})=>({pointerId:id,clientX:x,clientY:y,button:0,buttons:1,pointerType:'mouse',isPrimary:true,...extra});
  assert.deepEqual(c.get(),INITIAL_CAMERA);assert.equal(writes.length,0);
  c.move(pointer(1,50,50));assert.deepEqual(c.get(),INITIAL_CAMERA);
  assert.equal(c.down(pointer(1,0,0,{button:2})),false);
  assert.equal(c.down(pointer(1,0,0)),true);
  c.move(pointer(1,40,20));assert.equal(c.get().yaw,-10);assert.equal(c.get().pitch,-32.4);
  c.move(pointer(1,20,0));assert.equal(c.get().yaw,-16);assert.equal(c.get().pitch,-28);
  assert.equal(c.down(pointer(2,0,0)),false);
  const beforeSecond=c.get();c.move(pointer(2,500,500));assert.deepEqual(c.get(),beforeSecond);
  c.up(pointer(1));const stopped=c.get(), count=writes.length;
  c.move(pointer(1,999,999));await new Promise(resolve=>setTimeout(resolve,30));
  assert.deepEqual(c.get(),stopped);assert.equal(writes.length,count);
  c.down(pointer(1,0,0));c.move(pointer(1,50,50,{buttons:0}));
  assert.deepEqual(c.get(),stopped);c.move(pointer(1,100,100));assert.deepEqual(c.get(),stopped);
  c.down(pointer(1,0,0));c.cancel();c.move(pointer(1,500,500));assert.deepEqual(c.get(),stopped);
  c.down(pointer(1,0,0));c.move(pointer(1,0,10000));assert.equal(c.get().pitch,-42);
  c.move(pointer(1,0,-10000));assert.equal(c.get().pitch,-14);c.up(pointer(1));
  assert.deepEqual(Object.keys(c.get()).sort(),['pitch','yaw']);
  for(const removed of ['zoom','reset','setMode','key'])assert.equal(c[removed],undefined);
  const css=fs.readFileSync(path.resolve(__dirname,'../src/components/Courtyard.css'),'utf8');
  assert.match(css,/transition:none; animation:none/);
  assert.doesNotMatch(css,/society-orbit|model-controls|is-paused/);
  const component=fs.readFileSync(path.resolve(__dirname,'../src/components/Courtyard.jsx'),'utf8');
  assert.doesNotMatch(component,/requestAnimationFrame|onWheel|onKeyDown|<button|<footer/);
  console.log('PASS drag-only camera: stationary on hover/load/release/cancel, correct direction, pitch bounds, ignored extra pointers and no momentum or hidden controls');
  console.log('Handler/source tests only; no browser rendering or physical gestures executed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
