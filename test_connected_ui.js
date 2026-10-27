const {makeServer}=require('./server/server');
const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fleet-connected-')),server=await makeServer({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const accounts=JSON.parse(fs.readFileSync(path.join(dir,'initial-access.json'),'utf8')).accounts;
 const browser=await chromium.launch({channel:'msedge',headless:true});const contexts=[],errors=[];let checks=0;
 const check=(ok,label)=>{assert.ok(ok,label);checks++;console.log('PASS '+label);};
 async function open(role,language='en'){
  const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);await context.addInitScript(({base,role,language})=>{window.FleetAndroid={role:()=>role,serverURL:()=>base,configureServer:()=>{}};if(!localStorage.getItem('fleet_language'))localStorage.setItem('fleet_language',language);},{base,role,language});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/index.html?app='+role);
  const account=accounts.find(a=>a.role===role);await page.locator('#user').fill(account.username);await page.locator('#pass').fill(account.password);await page.locator('#loginForm button.primary').click();await page.waitForURL(url=>!url.pathname.endsWith('index.html'));await page.locator('#remote-status').waitFor();return page;
 }
 try{
  const entry=await open('entry','kn');await entry.waitForFunction(()=>document.documentElement.lang==='kn');
  check(await entry.locator('h1').innerText()==='ಬಸ್ ಪ್ರವೇಶ','Entry screen supports Kannada');
  await entry.locator('#bus-search').fill('273');await entry.locator('[data-bus="BM273"]').click();
  await entry.locator('#fleet-language').selectOption('hi');await entry.waitForFunction(()=>document.documentElement.lang==='hi');
  check(await entry.locator('h1').innerText()==='बस प्रवेश','Language switches to Hindi without losing selection');
  check(await entry.locator('#selection').innerText().then(t=>t.includes('BM273')),'Bus identifiers remain unchanged');
  await entry.locator('#fleet-language').selectOption('en');await entry.locator('#approve').click();await entry.locator('#confirm-save').click();await entry.waitForFunction(()=>document.getElementById('recent').textContent.includes('BM273'));
  const cleaner=await open('cleaner','hi');await cleaner.locator('[data-bus="BM273"]').waitFor();
  check(await cleaner.locator('h1').innerText()==='सफाई','Independent phone sees entry and renders Hindi');
  await cleaner.locator('[data-bus="BM273"]').click();await cleaner.locator('#approve').click();await cleaner.locator('#confirm-save').click();await cleaner.waitForFunction(()=>document.getElementById('recent').textContent.includes('BM273'));
  const charging=await open('charging','kn');await charging.locator('[data-bus="BM273"]').click();await charging.locator('#approve').click();await charging.locator('#confirm-save').click();await charging.waitForFunction(()=>document.getElementById('recent').textContent.includes('BM273'));
  check(await charging.evaluate(()=>FleetDB.Scheduler.getReadyPool('chandapura').some(b=>b.busId==='BM273')),'Connected approvals produce a shared ready bus');
  const scheduler=await open('scheduler');await scheduler.locator('#scheduler-route-select').waitFor();
  check(await scheduler.locator('#pool-count').innerText()==='1','Unapproved buses do not enter the ready pool');
  const manager=await open('manager','hi');check(await manager.locator('h1').innerText()==='डिपो प्रबंधक','Manager supports Hindi');
  const trip=await scheduler.evaluate(()=>SCHEDULES.find(s=>FleetDB.Scheduler.recommendAssignment(s.id,{depotId:'chandapura',schedules:SCHEDULES,fleet:FLEET,routes:ROUTES}).success)?.id);
  check(Boolean(trip),'A suitable real trip can be recommended');
  await scheduler.locator('#scheduler-route-select').selectOption(trip);await scheduler.locator('#scheduler-bus-select').selectOption('BM273');await scheduler.locator('#final-assign-btn').click();
  await scheduler.waitForFunction(()=>document.getElementById('scheduler-alert').textContent.includes('Confirmed!'));
  check(await scheduler.evaluate(()=>FleetDB.Scheduler.getAssignments().some(b=>b.busId==='BM273')),'Scheduler saves a real assignment through the shared server');
  await manager.locator('[data-return="BM273"]').waitFor({timeout:22000});await manager.locator('[data-return="BM273"]').click();await manager.locator('#return-save').click();
  await entry.waitForFunction(()=>FleetDB.EntryRecorder.getPending('chandapura').some(b=>b.busId==='BM273'),{timeout:22000});
  check(await entry.evaluate(()=>!FleetDB.Scheduler.getReadyPool('chandapura').some(b=>b.busId==='BM273')),'Explicit bus return restarts the workflow and removes stale readiness');
  await entry.locator('#bus-search').fill('273');await entry.locator('[data-bus="BM273"]').click();await contexts[0].setOffline(true);
  await entry.locator('#approve').click();await entry.locator('#confirm-save').click();
  await entry.waitForFunction(()=>document.getElementById('notice').textContent.includes('Save could not be confirmed'));
  await contexts[0].setOffline(false);await entry.evaluate(()=>FleetRemote.refresh());
  check(await entry.evaluate(()=>!FleetDB.EntryRecorder.init().BM273.entryApproved),'Offline action is not accepted or queued as an approval');
  const admin=await open('admin');check(admin.url().includes('mobile_admin.html'),'Admin APK has connected account management');
  check(await admin.locator('#users').innerText().then(t=>t.includes('chandapura-entry')),'Admin can see provisioned staff accounts');
  for(const target of [entry,cleaner,charging,scheduler,manager,admin])check(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone layout fits '+new URL(target.url()).pathname);
  await cleaner.locator('#fleet-language').selectOption('kn');await cleaner.reload();await cleaner.waitForFunction(()=>document.documentElement.lang==='kn');check(await cleaner.locator('h1').innerText()==='ಸ್ವಚ್ಛತೆ','Language preference survives app reload');
  check(errors.length===0,'No connected-screen JavaScript errors: '+errors.join('; '));
  const output=process.env.FLEET_ANDROID_PREVIEW;
  if(output){await entry.locator('#fleet-language').selectOption('kn');await entry.locator('#bus-search').fill('');await entry.screenshot({path:output,fullPage:false});}
  console.log(checks+' connected-app checks passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));await server.storageClosed;fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
