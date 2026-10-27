// Exercise the bundled APK web assets with their real app origin and live CORS.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const metadata=JSON.parse(fs.readFileSync(path.join(root,'cloud-trial.json'),'utf8'));
const access=JSON.parse(fs.readFileSync(path.join(root,metadata.privateAccessFile),'utf8'));
const accounts=[{...access.admin,role:'admin'},...access.staff];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;const errors=[];
 try{
  for(const account of accounts){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addInitScript(({url,role})=>{window.FleetAndroid={role:()=>'',serverURL:()=>url,configureServer(){}};},{url:metadata.server.url,role:account.role});
   await context.route('https://appassets.androidplatform.net/assets/**',route=>{
    const file=new URL(route.request().url()).pathname.slice('/assets/'.length),target=path.resolve(dist,file);
    if(!target.startsWith(dist+path.sep)||!fs.existsSync(target))return route.fulfill({status:404,body:'Not found'});
    const type={'.html':'text/html','.js':'application/javascript','.css':'text/css'}[path.extname(target)]||'application/octet-stream';
    return route.fulfill({status:200,contentType:type+'; charset=utf-8',body:fs.readFileSync(target)});
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await page.goto('https://appassets.androidplatform.net/assets/index.html');
   await page.locator('#user').fill(account.username);await page.locator('#pass').fill(account.password);await page.locator('#loginForm button.primary').click();
   await page.locator('iframe').waitFor({timeout:100000});const frame=await page.locator('iframe').elementHandle().then(el=>el.contentFrame());await frame.waitForFunction(()=>FleetRemote.ready,{timeout:30000});
   await page.locator('#fleet-language').selectOption('kn');
   if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error(account.role+' viewport overflow');
   if(account.role==='entry'){
    await frame.locator('#bus-search').fill('273');await frame.locator('#bus-select').selectOption('BM273');
    if(!await frame.locator('#submit-btn').isVisible())throw new Error('Entry action unavailable');
    await page.screenshot({path:path.join(root,'apk/online-entry-kannada.png'),fullPage:false});
   }
   if(account.role==='admin'){await frame.locator('.side-nav').waitFor();await frame.getByRole('button',{name:'Depot Logins',exact:true}).click();await frame.waitForFunction(()=>document.querySelector('.main-content').textContent.includes('chandapura-entry'));}
   console.log('PASS '+account.role+' live UI, app-origin CORS, Kannada and phone viewport');checks++;
   await page.evaluate(()=>FleetRemote.logout());await context.close();
  }
  if(errors.length)throw new Error(errors.join('; '));
  console.log(checks+' live bundled-app UI checks passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
