// Smoke-test an installed debug APK on our test emulator using its debug WebView.
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const adb=process.env.ADB_PATH||process.env.LOCALAPPDATA+'\\Android\\Sdk\\platform-tools\\adb.exe';
const serial=process.env.ANDROID_SERIAL||'emulator-5580',port=9225;
const live=process.argv.includes('--live');
const selectedRoles=process.argv.slice(2).filter(arg=>arg!=='--live');
const roles=selectedRoles.length?selectedRoles:['entry'];
const command=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8'}).trim();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(role){
 const attachPort=port+['entry','cleaner','charging','scheduler','manager','admin'].indexOf(role);
 const pid=command('shell','pidof','in.smartfleet.depot.'+role);
 command('forward','tcp:'+attachPort,'localabstract:webview_devtools_remote_'+pid);
 let pages;for(let i=0;i<30;i++){try{pages=await(await fetch('http://127.0.0.1:'+attachPort+'/json',{headers:{Connection:'close'}})).json();if(pages.length)break;}catch(_){}await pause(300);}
 if(!pages?.length)throw new Error('Android debug WebView not found');
 const ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=()=>reject(new Error('Android WebView debug connection failed for '+role));});let id=0;const pending=new Map();
 ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){pending.get(msg.id)?.resolve(msg);pending.delete(msg.id);}};
 ws.onclose=()=>{for(const handler of pending.values())handler.reject(new Error('Android debug connection closed'));pending.clear();};
 return {close:()=>ws.close(),evaluate:async expression=>{const current=++id;let timer;const result=new Promise((resolve,reject)=>{pending.set(current,{resolve,reject});timer=setTimeout(()=>{pending.delete(current);reject(new Error('Android debug command timed out'));},12000);});ws.send(JSON.stringify({id:current,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const response=await result.finally(()=>clearTimeout(timer));if(response.result?.exceptionDetails)throw new Error(response.result.exceptionDetails.text+' (WebView evaluation failed)');return response.result?.result?.value;}};
}
async function wait(client,expression){for(let i=0;i<60;i++){if(await client.evaluate(expression))return;await pause(300);}throw new Error('Android screen did not become ready');}
(async()=>{
 const saved=JSON.parse(fs.readFileSync(live?'server/data/cloud-trial-access.json':'server/data/initial-access.json','utf8'));
 const accounts=live?[{...saved.admin,role:'admin'},...saved.staff]:saved.accounts;
 for(const role of roles){
  console.log('Checking Android '+role+'…');
  command('install','-r','apk/app-'+role+'-debug.apk');command('shell','am','force-stop','in.smartfleet.depot.'+role);command('shell','am','start','-n','in.smartfleet.depot.'+role+'/in.smartfleet.depot.MainActivity');await pause(800);
  const client=await connect(role);
  try{
   await wait(client,"Boolean(document.getElementById('loginForm'))");
   if(!await client.evaluate('Boolean(FleetAndroid.serverURL())')){
    await client.evaluate('FleetAndroid.configureServer()');await pause(300);
    // Inspect the native dialog before each tap (its bounds change with the keyboard).
    function node(className,resource){command('shell','uiautomator','dump','/sdcard/fleet-smoke.xml');const xml=command('shell','cat','/sdcard/fleet-smoke.xml');const nodes=xml.match(/<node\b[^>]+>/g)||[];const found=nodes.find(n=>resource?n.includes('resource-id="'+resource+'"'):n.includes('class="'+className+'"'));if(!found)throw new Error('Native settings control not found');const bounds=found.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);command('shell','input','tap',String((+bounds[1]+ +bounds[3])/2|0),String((+bounds[2]+ +bounds[4])/2|0));}
    node('android.widget.EditText');command('shell','input','text','http://10.0.2.2:8787');command('shell','input','keyevent','4');node(null,'android:id/button1');await pause(700);
   }
   const account=accounts.find(a=>a.role===role);
   await client.evaluate(`document.getElementById('user').value=${JSON.stringify(account.username)};document.getElementById('pass').value=${JSON.stringify(account.password)};setTimeout(()=>document.getElementById('loginForm').dispatchEvent(new Event('submit',{cancelable:true})),50);true;`);
   await wait(client,"Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('h1'))");
   await wait(client,"Boolean(document.querySelector('iframe')?.contentWindow?.FleetRemote?.ready)");
   await client.evaluate("FleetI18n.setLanguage('kn')");await pause(200);
   const title=await client.evaluate("document.querySelector('iframe')?.contentDocument?.querySelector('h1')?.textContent");if(!title||/^(Bus entry|Cleaning|Charging|Depot manager)$/.test(title))throw new Error('Kannada title missing');
   if(!await client.evaluate('document.documentElement.scrollWidth<=innerWidth'))throw new Error('Android horizontal overflow');
   console.log('PASS Android '+role+' login, server connection, Kannada, and viewport');
   if(role==='entry'){
    await client.evaluate("FleetI18n.setLanguage('hi')");if(await client.evaluate("document.querySelector('iframe').contentDocument.querySelector('h1').textContent")!=='डिपो बस प्रवेश')throw new Error('Hindi title missing');
    await client.evaluate("FleetI18n.setLanguage('kn')");await pause(200);
    fs.writeFileSync('apk/android-entry-preview.png',execFileSync(adb,['-s',serial,'exec-out','screencap','-p']));
   }
  }finally{client.close();}
 }
})().catch(error=>{console.error(error.message||String(error));process.exitCode=1;});
