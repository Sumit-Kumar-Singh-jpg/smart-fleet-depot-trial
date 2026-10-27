const {makeServer}=require('./server/server');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fleet-dashboard-'));
 let storage;
 if(process.argv.includes('--postgres')){
  const {PGlite}=require('@electric-sql/pglite'),{postgresAdapter}=require('./server/storage');
  const engine=new PGlite();storage=postgresAdapter(engine,fn=>engine.transaction(tx=>fn(postgresAdapter(tx))));storage.close=()=>engine.close();
 }
 const server=await makeServer({dataDir:directory,storage,adminPassword:'dashboard-fixture-password'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
 const check=(ok,label)=>{assert.ok(ok,label);checks++;console.log('PASS '+label);};
 const request=async(route,token,body)=>{
  const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:r.status,...await r.json()};
 };
 try{
  const admin=await request('/api/login',null,{username:'admin',password:'dashboard-fixture-password'});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(base=>{window.FleetAndroid={role:()=>'',serverURL:()=>base,configureServer(){}};},base);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#user').fill('admin');await page.locator('#pass').fill('dashboard-fixture-password');await page.locator('#loginForm button.primary').click();
  const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Manage',exact:true}).click();
  await frame.locator('#m_count').fill('1');await frame.locator('#m_b').fill('TEST901, KA99AA0901');await frame.getByRole('button',{name:'Add buses',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('sfos_multi_v2')).buses.some(b=>b.id==='TEST901'));
  let state=await request('/api/state',admin.token),network=JSON.parse(state.store.sfos_multi_v2);
  check(network.buses.some(b=>b.id==='TEST901'),'Original Manage form saves new bus on shared server');
  await frame.getByRole('button',{name:'Add Depot',exact:true}).click();
  await frame.locator('#f_name').fill('Trial depot');await frame.locator('#f_city').fill('Bengaluru');await frame.locator('#f_count').fill('1');await frame.locator('#f_buses').fill('TEST902, KA99AA0902');
  await frame.locator('#f_sched').fill('TRIAL-101');await frame.locator('#f_drv').fill('Trial Driver');await frame.getByRole('button',{name:'Add depot & generate logins',exact:true}).click();
  await frame.locator('.main-content h2').filter({hasText:'Logins'}).waitFor();
  state=await request('/api/state',admin.token);network=JSON.parse(state.store.sfos_multi_v2);
  check(network.depots.some(d=>d.id==='trial'),'Original Add Depot form commits depot');
  const users=(await request('/api/admin/users',admin.token)).users;
  check(users.filter(u=>u.depot==='trial').length===5,'Depot creation generates five actual authenticated accounts');
  const f=await page.locator('iframe').elementHandle().then(e=>e.contentFrame());
  const newUser=await f.evaluate(()=>S.depots.find(d=>d.id==='trial').users.entry);
  const entry=await request('/api/login',null,{username:newUser.u,password:newUser.p});
  check(entry.status===200&&entry.session.id==='entry','Generated account signs in through unrestricted login');
  check(!JSON.stringify(state.store).includes(newUser.p),'Generated passwords excluded from snapshots');
  const edit=structuredClone(network);edit.buses.find(b=>b.id==='TEST901').reg='KA99AA0199';
  const saved=await request('/api/admin/network',admin.token,{network:edit,revision:state.revision});
  check(saved.status===200,'Admin fleet edit persists');
  check((await request('/api/admin/network',admin.token,{network,revision:state.revision})).status===409,'Stale dashboard cannot overwrite newer records');
  check((await request('/api/admin/network',entry.token,{network,revision:saved.revision})).status===404,'Staff cannot edit depot configuration');
  const forged=JSON.parse(saved.store.sfos_multi_v2);forged.buses.find(b=>b.id==='TEST901').entry=true;
  check((await request('/api/admin/network',admin.token,{network:forged,revision:saved.revision})).status===400,'Dashboard cannot forge workflow approvals');
  const duplicate=JSON.parse(saved.store.sfos_multi_v2);duplicate.buses.find(b=>b.id==='TEST901').reg=duplicate.buses[0].reg;
  check((await request('/api/admin/network',admin.token,{network:duplicate,revision:saved.revision})).status===400,'Duplicate physical registration rejected');
  const before=(await request('/api/state',admin.token)).revision;
  check(before===saved.revision,'Rejected changes leave state untouched');
  await request('/api/admin/users',admin.token,{username:newUser.u,password:'demo1234',role:'entry',depot:'trial'});
  check((await request('/api/login',null,{username:newUser.u,password:'demo1234'})).status===200,'Requested eight-character demo password supported');
  check((await request('/api/state',entry.token)).status===401,'Changing password revokes previous sessions');
  // Verify a configuration transfer clears approval records and supports a new cycle.
  const freshEntry=await request('/api/login',null,{username:newUser.u,password:'demo1234'});
  check((await request('/api/action',freshEntry.token,{action:'approve',busId:'TEST902',requestId:crypto.randomUUID()})).status===200,'New depot bus completes real entry approval');
  state=await request('/api/state',admin.token);network=JSON.parse(state.store.sfos_multi_v2);
  Object.assign(network.buses.find(b=>b.id==='TEST902'),{loc:null,entry:false,clean:false,charge:false,route:'',driver:'',transferFrom:'trial',transferTo:'chandapura',transferStatus:'in_transit',linkedDepots:['trial','chandapura']});
  const transferred=await request('/api/admin/network',admin.token,{network,revision:state.revision});
  check(transferred.status===200&&!JSON.parse(transferred.store.smart_fleet_db_entry_recorder).TEST902.entryApproved,'Transfer clears stale entry approval');
  check(!JSON.parse(transferred.store.smart_fleet_db_cleaner).TEST902,'Transfer removes old depot cleaning queue');
  await request('/api/admin/users',admin.token,{username:'check-entry',password:'fixture-password',role:'entry',depot:'chandapura'});
  const receiving=await request('/api/login',null,{username:'check-entry',password:'fixture-password'});
  check((await request('/api/action',receiving.token,{action:'approve',busId:'TEST902',requestId:crypto.randomUUID()})).status===200,'Transferred bus can enter destination depot');
  // The new bus in the original depot must also be accepted, without a bundled fixture.
  check((await request('/api/action',receiving.token,{action:'approve',busId:'TEST901',requestId:crypto.randomUUID()})).status===200,'Newly registered Chandapura bus enters correctly');
  check(errors.length===0,'Admin dashboard has no uncaught browser errors');
  console.log(checks+' admin dashboard checks passed'+(storage?' on PostgreSQL.':'.'));
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));await server.storageClosed;
  const target=path.resolve(directory);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('fleet-dashboard-'));fs.rmSync(target,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
