const {makeServer}=require('./server/server');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fleet-wake-')),server=await makeServer({dataDir:dir});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const account=JSON.parse(fs.readFileSync(path.join(dir,'initial-access.json'),'utf8')).accounts.find(a=>a.role==='entry');
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext();
 await context.addInitScript(base=>localStorage.setItem('fleet_server',base),base);
 let release,healthCount=0,loginCount=0,checks=0;const gate=new Promise(r=>release=r),statePaths=[];
 const page=await context.newPage();const check=(ok,name)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
 page.on('request',r=>{if(r.url().endsWith('/api/login'))loginCount++;if(r.url().includes('/api/state'))statePaths.push(r.url());});
 await page.route('**/api/health',async route=>{healthCount++;if(healthCount===1){await gate;return route.fulfill({status:503,contentType:'text/html',body:'Starting service'});}return route.continue();});
 try{
  await page.goto(base+'/index.html?app=entry');await page.locator('#user').fill(account.username);await page.locator('#pass').fill(account.password);
  await page.locator('#loginForm button.primary').click();
  check(await page.locator('#loginForm button.primary').isDisabled(),'Repeated sign-in disabled while server is starting');
  check(loginCount===0,'Credentials are not submitted before server readiness');
  check(await page.locator('#remote-status').innerText()==='Starting server…','Visible cold-start explanation');
  release();await page.waitForURL('**/entry_recorder.html?depotId=chandapura');
  await page.waitForFunction(()=>FleetRemote.ready);
  check(healthCount>=2&&loginCount===1,'Cold-start HTML response is retried; credentials submitted once');
  await page.locator('#bus-search').fill('304');await page.locator('[data-bus="BM304"]').click();
  await page.evaluate(()=>FleetRemote.refresh());
  check(statePaths.some(p=>p.includes('?since=')),'Polling sends known revision to reduce database traffic');
  check(await page.locator('[data-bus="BM304"]').getAttribute('aria-pressed')==='true','Unchanged poll preserves explicit bus selection');
  await page.locator('#fleet-language').selectOption('kn');await page.waitForFunction(()=>document.documentElement.lang==='kn');
  check(await page.locator('#remote-status').innerText()==='ಸಂಪರ್ಕಗೊಂಡಿದೆ','Connection state is translated into Kannada');
  console.log(checks+' startup and polling checks passed.');
 }finally{release();await browser.close();await new Promise(r=>server.close(r));await server.storageClosed;const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('fleet-wake-'));fs.rmSync(target,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
