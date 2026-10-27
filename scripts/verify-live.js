// Uses locally stored trial accounts. Never prints passwords or session tokens.
// With --workflow, completes one cycle for an untouched sample bus and returns it.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const metadata=JSON.parse(fs.readFileSync(path.join(ROOT,'cloud-trial.json'),'utf8'));
const base=process.env.FLEET_LIVE_URL||metadata.server.url;
if(!base||!base.startsWith('https://'))throw new Error('Set an HTTPS live trial URL');
const access=JSON.parse(fs.readFileSync(path.join(ROOT,metadata.privateAccessFile),'utf8'));
const accounts=[{...access.admin,role:'admin'},...access.staff];
let checks=0;
const check=(ok,label)=>{if(!ok)throw new Error(label);checks++;console.log('PASS '+label);};
async function request(route,token,body){
 const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
 const data=await response.json();return {status:response.status,...data};
}
const action=(token,name,values={})=>request('/api/action',token,{action:name,busId:'BM273',requestId:crypto.randomUUID(),...values});
(async()=>{
 check((await request('/api/health')).ok,'Live HTTPS health');
 check((await request('/api/state')).status===401,'Live unauthenticated data access rejected');
 const sessions={};
 for(const account of accounts){const result=await request('/api/login',null,account);check(result.status===200,account.role+' live sign-in');sessions[account.role]=result;}
 let state=await request('/api/state',sessions.manager.token);
 check(JSON.parse(state.store.sfos_multi_v2).buses.length===122,'Shared sample fleet available');
 if(process.argv.includes('--workflow')){
  const bus=JSON.parse(state.store.sfos_multi_v2).buses.find(b=>b.id==='BM273');
  if(!bus||bus.entry||bus.route)throw new Error('Sample verification bus is already in use; no changes made');
  check((await action(sessions.entry.token,'approve')).status===200,'Live entry approval');
  check((await action(sessions.cleaner.token,'report',{reason:'Other problem',notes:'Automated trial verification: manager review required.'})).status===200,'Live problem report');
  check((await action(sessions.cleaner.token,'approve')).status!==200,'Live issue hold prevents approval');
  state=await request('/api/state',sessions.manager.token);const issue=JSON.parse(state.store.smart_fleet_issues).find(i=>i.busId==='BM273'&&!i.resolvedAt);
  check((await action(sessions.manager.token,'resolve',{issueId:issue.id,resolution:'Automated trial verification completed; sample bus released.'})).status===200,'Live manager resolves problem');
  check((await action(sessions.cleaner.token,'approve')).status===200,'Live cleaning approval');
  check((await action(sessions.charging.token,'approve')).status===200,'Live charging approval');
  state=await request('/api/state',sessions.scheduler.token);
  const store=state.store,ctx={console,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v)},dispatchEvent(){},CustomEvent:function(){}};ctx.window=ctx;ctx.global=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/data/app_data.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(ROOT,'src/js/database.js'),'utf8'),ctx);
  const recommendation=vm.runInContext('SCHEDULES.map(s=>FleetDB.Scheduler.recommendAssignment(s.id,{depotId:"chandapura",schedules:SCHEDULES,fleet:FLEET,routes:ROUTES})).find(r=>r.success)',ctx);
  if(!recommendation)throw new Error('No eligible sample assignment');
  const assigned=await action(sessions.scheduler.token,'assign',{scheduleId:recommendation.schedule.id,busId:recommendation.bus.busId,driverName:recommendation.driver});
  check(assigned.status===200,'Live route and driver assignment');
  check((await action(sessions.manager.token,'return')).status===200,'Live explicit bus return');
  state=await request('/api/state',sessions.entry.token);check(!JSON.parse(state.store.sfos_multi_v2).buses.find(b=>b.id==='BM273').entry,'Bus is reset for the next trial cycle');
 }
 const compact=await request('/api/state?since='+state.revision,sessions.manager.token);check(compact.unchanged,'Live compact revision polling');
 for(const session of Object.values(sessions))await request('/api/logout',session.token,{});
 console.log(JSON.stringify({checks,revision:state.revision,base}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
