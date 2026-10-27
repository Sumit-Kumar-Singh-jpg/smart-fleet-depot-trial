const {makeServer}=require('./server/server');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fleet-original-ui-')),server=await makeServer({dataDir:dir});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const accounts=JSON.parse(fs.readFileSync(path.join(dir,'initial-access.json'),'utf8')).accounts;
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];let checks=0;
 const check=(ok,label)=>{assert.ok(ok,label);checks++;console.log('PASS '+label);};
 async function open(role){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(({base,role})=>{window.FleetAndroid={role:()=>'',serverURL:()=>base,configureServer(){}};},{base,role});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/index.html');
  const account=accounts.find(a=>a.role===role);await page.locator('#user').fill(account.username);await page.locator('#pass').fill(account.password);await page.locator('#loginForm button.primary').click();
  await page.locator('iframe').waitFor();const frame=await page.locator('iframe').elementHandle().then(el=>el.contentFrame());
  await frame.waitForFunction(()=>Boolean(window.FleetRemote?.ready));return {page,frame,context};
 }
 try{
  const entry=await open('entry');
  check(await entry.page.locator('.welcome h1').innerText()==='Gate intake','Original outer console frame restored');
  check(await entry.frame.locator('h1').innerText()==='Depot Intake & Entry Recorder','Original entry heading restored');
  check(await entry.frame.locator('#bus-select').count()===1&&await entry.frame.locator('.bus-card').count()===0,'Original bus dropdown replaces redesigned cards');
  check(await entry.frame.locator('#submit-btn').innerText()==='Submit','Original Submit label restored');
  check(await entry.page.locator('.language-bar,.connection-bar').count()===0,'Added full-width toolbars removed');
  if(process.env.FLEET_ORIGINAL_PREVIEW)await entry.page.screenshot({path:process.env.FLEET_ORIGINAL_PREVIEW,fullPage:false});
  await entry.frame.locator('#bus-search').fill('273');check(await entry.frame.locator('#bus-select').inputValue()==='','Search still requires explicit bus selection');
  await entry.frame.locator('#bus-select').selectOption('BM273');await entry.frame.locator('#submit-btn').click();await entry.frame.waitForFunction(()=>FleetDB.EntryRecorder.init().BM273.entryApproved);
  check(await entry.frame.locator('#statusAlert').innerText().then(t=>t.includes('saved')),'Restored entry form saves through cloud API');
  const cleaner=await open('cleaner');check(await cleaner.frame.locator('h1').innerText()==='Cleaning Bay Operations','Original cleaning layout restored');
  await cleaner.frame.locator('#bus-search').fill('273');check(await cleaner.frame.locator('#bus-select').inputValue()==='','Cleaner search does not auto-approve or auto-select');
  await cleaner.frame.locator('#bus-select').selectOption('BM273');await cleaner.frame.locator('#submit-btn').click();await cleaner.frame.waitForFunction(()=>FleetDB.Cleaner.init().BM273.cleanApproved);
  const charging=await open('charging');await charging.frame.locator('#bus-select').selectOption('BM273');await charging.frame.locator('#submit-btn').click();await charging.frame.waitForFunction(()=>FleetDB.Charging.init().BM273.chargeApproved);
  check(await charging.frame.locator('h1').innerText()==='Charging Infrastructure Operations','Original charging form works with shared data');
  const scheduler=await open('scheduler');check(await scheduler.frame.locator('#final-assign-btn').innerText()==='Confirm & Save Assignment','Original scheduler presentation restored');
  const trip=await scheduler.frame.evaluate(()=>SCHEDULES.find(s=>FleetDB.Scheduler.recommendAssignment(s.id,{depotId:'chandapura',schedules:SCHEDULES,fleet:FLEET,routes:ROUTES}).success)?.id);
  await scheduler.frame.locator('#scheduler-route-select').selectOption(trip);await scheduler.frame.locator('#scheduler-bus-select').selectOption('BM273');await scheduler.frame.locator('#final-assign-btn').click();await scheduler.frame.waitForFunction(()=>FleetDB.Scheduler.getAssignments().some(b=>b.busId==='BM273'));
  check(true,'Original scheduler form commits assignment');
  await scheduler.frame.locator('.logout-btn').click();await scheduler.page.locator('#loginForm').waitFor();
  const manager=await open('manager');check(await manager.frame.evaluate(()=>FleetDB.Scheduler.getAssignments().some(b=>b.busId==='BM273')),'Logout still preserves bus assignments');
  await manager.frame.locator('[data-return="BM273"]').click();await manager.frame.locator('#return-save').click();await manager.frame.waitForFunction(()=>!FleetDB.Scheduler.getAssignments().some(b=>b.busId==='BM273'));
  const admin=await open('admin');await admin.frame.locator('.side-nav').waitFor();
  check(await admin.frame.locator('.nav-item').count()===8,'Repository Admin dashboard navigation restored');
  await admin.frame.getByRole('button',{name:'Depot Logins',exact:true}).click();
  check(await admin.frame.locator('.main-content').innerText().then(t=>t.includes('chandapura-entry')),'Admin dashboard lists actual server accounts');
  await admin.frame.locator('.logout-item').click();await admin.page.locator('#loginForm').waitFor();
  for(const role of ['entry','cleaner','charging','scheduler','manager','admin']){
    const account=accounts.find(a=>a.role===role);
    await admin.page.locator('#user').fill(account.username);await admin.page.locator('#pass').fill(account.password);await admin.page.locator('#loginForm button.primary').click();
    await admin.page.waitForFunction(role=>JSON.parse(sessionStorage.getItem('fleet_session')||'null')?.id===role,role);
    const consoleFrame=await admin.page.locator('iframe').elementHandle().then(el=>el.contentFrame());
    await consoleFrame.waitForFunction(()=>Boolean(window.FleetRemote?.ready));
    // Use the real child logout to end both parent and iframe sessions.
    await consoleFrame.evaluate(async()=>{if(typeof signOut==='function')await signOut();else if(typeof schedulerLogout==='function')await schedulerLogout();else if(typeof goToLogin==='function')await goToLogin();else document.getElementById('signout').click();});
    await admin.page.locator('#loginForm').waitFor();
  }
  check(true,'One unrestricted app signs in and signs out across all six roles');
  await cleaner.page.locator('#fleet-language').selectOption('kn');await cleaner.frame.waitForFunction(()=>document.documentElement.lang==='kn');
  check(await cleaner.frame.locator('#submit-btn').innerText()==='ಸಲ್ಲಿಸಿ','Language support works inside restored console');
  check(await entry.page.evaluate(()=>getComputedStyle(document.querySelector('.login')||document.body).fontFamily.includes('Inter')),'Original font family retained');
  check(errors.length===0,'No uncaught errors in restored screens: '+errors.join('; '));
  if(process.env.FLEET_ORIGINAL_PREVIEW){await entry.frame.evaluate(()=>FleetRemote.refresh());await entry.page.screenshot({path:process.env.FLEET_ORIGINAL_PREVIEW,fullPage:false});}
  console.log(checks+' original UI integration checks passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));await server.storageClosed;const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('fleet-original-ui-'));fs.rmSync(target,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
