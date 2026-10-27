const {makeServer}=require('./server/server');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fleet-api-'));const server=await makeServer({dataDir:dir});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root='http://127.0.0.1:'+server.address().port;
 const accounts=JSON.parse(fs.readFileSync(path.join(dir,'initial-access.json'),'utf8')).accounts;let checks=0;
 const check=(condition,name)=>{assert.ok(condition,name);checks++;console.log('PASS '+name);};
 async function call(route,token,body){const response=await fetch(root+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};}
 const login=role=>{const a=accounts.find(x=>x.role===role);return call('/api/login',null,{username:a.username,password:a.password,role});};
 const act=(token,action,values={})=>call('/api/action',token,{action,busId:'BM304',requestId:crypto.randomUUID(),...values});
 try{
  const entry=await login('entry'),cleaner=await login('cleaner'),charge=await login('charging'),manager=await login('manager'),sched=await login('scheduler'),admin=await login('admin');
  check([entry,cleaner,charge,manager,sched,admin].every(r=>r.status===200),'All six server roles authenticate');
  check((await call('/api/state')).status===401,'Unauthenticated state access rejected');
  check(!JSON.stringify(entry.store).includes('password'),'Snapshots contain no password credentials');
  check((await act(cleaner.token,'approve')).status!==200,'Cleaning before entry is rejected');
  check((await act(entry.token,'assign')).status===403,'Role escalation is rejected');
  check((await act(entry.token,'approve')).status===200,'Entry approval saves on server');
  const duplicate=await Promise.all([act(cleaner.token,'approve'),act(cleaner.token,'approve')]);
  check(duplicate.filter(r=>r.status===200).length===1,'Concurrent approvals commit only once');
  let state=await call('/api/state',charge.token);check(JSON.parse(state.store.smart_fleet_db_cleaner).BM304.cleanApproved,'Separate charging session sees cleaner update');
  check((await act(charge.token,'report',{reason:'Charger not working',notes:'Fixture'})).status===200,'Problem report is shared');
  check((await act(charge.token,'approve')).status!==200,'Unresolved problem blocks charging');
  state=await call('/api/state',manager.token);const issue=JSON.parse(state.store.smart_fleet_issues)[0];
  check((await act(entry.token,'resolve',{issueId:issue.id,resolution:'Fixed'})).status===403,'Worker cannot resolve manager hold');
  check((await act(manager.token,'resolve',{issueId:issue.id,resolution:'Inspected charger'})).status===200,'Manager resolves hold');
  check((await act(charge.token,'approve')).status===200,'Charging approval succeeds after resolution');
  state=await call('/api/state',sched.token);check(Boolean(JSON.parse(state.store.smart_fleet_db_scheduler).BM304),'Both approvals enroll scheduler record');
  const requestId=crypto.randomUUID();const first=await call('/api/action',entry.token,{action:'report',busId:'BM304',reason:'Battery not ready',requestId});const retry=await call('/api/action',entry.token,{action:'report',busId:'BM304',reason:'Battery not ready',requestId});
  check(first.status===200&&retry.status===200&&retry.replayed,'Retried request is idempotent');
  check((await call('/api/admin/users',entry.token)).status===404,'Worker cannot list staff accounts');
  check((await call('/api/admin/users',admin.token)).users.length===6,'Admin can list accounts without password hashes');
  const wrong=await call('/api/login',null,{username:accounts[1].username,password:accounts[1].password,role:'manager'});check(wrong.status===401,'App-specific role sign-in is enforced');
  await call('/api/logout',entry.token,{});check((await call('/api/state',entry.token)).status===401,'Logout revokes server session');
  check((await call('/api/action',manager.token,{action:'return',busId:'unrelated',requestId:crypto.randomUUID()})).status===403,'Foreign bus action is rejected');
  console.log(checks+' shared-server checks passed.');
 }finally{await new Promise(resolve=>server.close(resolve));await server.storageClosed;fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
