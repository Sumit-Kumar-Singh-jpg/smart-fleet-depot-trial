// Execute the PostgreSQL dialect against an embedded real PostgreSQL engine.
// Live Neon TLS/network verification is separate and requires a connected Neon account.
const {PGlite}=require('@electric-sql/pglite');
const {postgresAdapter}=require('./server/storage');
const {makeServer}=require('./server/server');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fleet-pg-')),databasePath=path.join(dir,'postgres');
 const password='fixture-admin-password-not-real';let server,root,checks=0;
 const check=(ok,name)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
 async function start(){
  const engine=new PGlite(databasePath);
  const storage=postgresAdapter(engine,callback=>engine.transaction(tx=>callback(postgresAdapter(tx))));storage.close=()=>engine.close();
  server=await makeServer({storage,adminPassword:password,dataDir:path.join(dir,'unused-local')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root='http://127.0.0.1:'+server.address().port;
 }
 async function stop(){if(server){await new Promise(resolve=>server.close(resolve));await server.storageClosed;server=null;}}
 async function call(route,token,body){const r=await fetch(root+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
 const login=role=>call('/api/login',null,{username:role==='admin'?'admin':'trial-'+role,password,role});
 const act=(token,action,values={})=>call('/api/action',token,{action,busId:'BM273',requestId:crypto.randomUUID(),...values});
 try{
  await start();check(server.storageKind==='postgres','PostgreSQL storage selected');
  check(!fs.existsSync(path.join(dir,'unused-local','initial-access.json')),'Cloud bootstrap writes no password file');
  const admin=await login('admin');check(admin.status===200,'Cloud admin authenticates with configured bootstrap password');
  for(const role of ['entry','cleaner','charging','scheduler','manager'])check((await call('/api/admin/users',admin.token,{username:'trial-'+role,password,role,depot:'chandapura'})).status===200,'Admin provisions '+role+' in PostgreSQL');
  const entry=await login('entry'),cleaner=await login('cleaner'),charging=await login('charging');
  check((await act(entry.token,'approve')).status===200,'Entry persists in PostgreSQL');
  const duplicate=await Promise.all([act(cleaner.token,'approve'),act(cleaner.token,'approve')]);check(duplicate.filter(r=>r.status===200).length===1,'PostgreSQL transaction rejects simultaneous duplicate approval');
  check((await act(charging.token,'approve')).status===200,'Second role completes readiness');
  const requestId=crypto.randomUUID(),payload={action:'report',busId:'BM273',reason:'Battery not ready',requestId};
  const requests=await Promise.all([call('/api/action',entry.token,payload),call('/api/action',entry.token,payload)]);
  check(requests.every(r=>r.status===200)&&requests.filter(r=>r.replayed).length===1,'Concurrent request-ID replay commits exactly once');
  let state=await call('/api/state',charging.token);check(JSON.parse(state.store.smart_fleet_issues).length===1,'Only one problem report persisted');
  const compact=await call('/api/state?since='+state.revision,charging.token);check(compact.unchanged&&!compact.store,'Unchanged polling avoids transmitting the full database');
  const savedRevision=state.revision,savedToken=charging.token;
  await stop();await start();
  const after=await call('/api/state',savedToken);check(after.status===200&&after.revision===savedRevision,'Session and revision survive a complete server/database restart');
  check(JSON.parse(after.store.smart_fleet_db_cleaner).BM273.cleanApproved&&JSON.parse(after.store.smart_fleet_db_charging).BM273.chargeApproved,'Bus approvals survive restart');
  check((await login('admin')).status===200,'Admin account survives restart without re-seeding');
  const manager=await login('manager'),issue=JSON.parse(after.store.smart_fleet_issues)[0];
  check((await act(manager.token,'resolve',{issueId:issue.id,resolution:'Checked after restart'})).status===200,'Persisted problem resolves after restart');
  check((await act(entry.token,'assign')).status===403,'PostgreSQL backend retains role enforcement');
  check((await call('/api/admin/users',(await login('admin')).token)).users.length===6,'Restart does not create duplicate accounts');
  console.log(checks+' PostgreSQL checks passed.');
 }finally{await stop();const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('fleet-pg-'));fs.rmSync(target,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
