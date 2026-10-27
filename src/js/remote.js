(() => {
  'use strict';
  const native=window.FleetAndroid;
  const server=(native?.serverURL()||localStorage.getItem('fleet_server')||(document.querySelector('meta[name="fleet-api"]')?.content==='same-origin'?location.origin:'')).replace(/\/+$/,'');
  const connected=Boolean(server),required=Boolean(native),appRole=native?.role()||new URL(location.href).searchParams.get('app')||'';
  let pending=false,ready=false,lastRevision=null,warming=null;
  let token=sessionStorage.getItem('fleet_token')||'';
  function apply(result,force=false){
    if(result.unchanged){ready=true;return;}
    if(!result.store)return;
    if(!force&&result.revision===lastRevision){ready=true;return;}
    for(const [key,value] of Object.entries(result.store))localStorage.setItem(key,value);
    lastRevision=result.revision;
    ready=true;window.dispatchEvent(new CustomEvent('fleet-db-updated',{detail:{stage:'remote'}}));
  }
  function status(message,offline=false){const label=document.getElementById('remote-status');if(label)label.textContent=message;document.querySelector('.connection-bar')?.classList.toggle('offline',offline);}
  async function request(route,body){
    if(!server)throw new Error('Configure the depot server to sign in.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;try{response=await fetch(server+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});}finally{clearTimeout(timer);}
    const result=await response.json();
    if(!response.ok){if(response.status===401&&route!=='/api/login'){sessionStorage.removeItem('fleet_token');token='';ready=false;}const error=new Error(result.error||'Could not connect to depot server');error.notSaved=true;throw error;}return result;
  }
  function warmup(){
    if(warming)return warming;
    warming=(async()=>{
      status('Starting server…');
      const deadline=Date.now()+90000;
      do{
        try{const result=await request('/api/health');if(result.ok){status('Connected');return;}}catch(_){}
        if(!navigator.onLine)throw new Error('Offline — reconnect before saving');
        await new Promise(resolve=>setTimeout(resolve,2000));
      }while(Date.now()<deadline);
      throw new Error('Server is not ready yet. Please try again.');
    })().catch(error=>{status(error.message,true);throw error;}).finally(()=>{warming=null;});
    return warming;
  }
  window.FleetRemote={
    enabled:connected,required,appRole,get ready(){return ready;},
    async login(username,password,role){const button=document.querySelector('#loginForm button.primary');if(button)button.disabled=true;try{await warmup();const result=await request('/api/login',{username,password,role:role||appRole||undefined});token=result.token;sessionStorage.setItem('fleet_token',token);apply(result,true);return {...result.session,u:result.session.u};}finally{if(button)button.disabled=false;}},
    async refresh(){if(!connected||!token||pending)return;pending=true;try{apply(await request('/api/state'+(lastRevision===null?'':'?since='+encodeURIComponent(lastRevision))));status('Connected');}catch(error){ready=false;status('Offline — reconnect before saving',true);}finally{pending=false;}},
    async perform(action,values){if(!connected||!token)throw new Error('Sign in again to continue');pending=true;try{const result=await request('/api/action',{action,...values,requestId:crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')});apply(result);status('Connected');return result;}catch(error){error.confirmationUnknown=!error.notSaved;status(error.confirmationUnknown?'Save could not be confirmed. Refresh to check recent work.':'Could not save. Refresh before trying again.',true);throw error;}finally{pending=false;}},
    async logout(){if(connected&&token)try{await request('/api/logout',{});}catch(_){}token='';sessionStorage.removeItem('fleet_token');},
    async users(){return request('/api/admin/users');},async saveUser(body){return request('/api/admin/users',body);},
    loginURL(){return 'index.html'+(appRole?'?app='+encodeURIComponent(appRole):'');}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    if(!required&&!connected)return;
    const bar=document.createElement('div');bar.className='connection-bar';bar.innerHTML='<span id="remote-status" role="status" aria-live="polite"></span><button id="server-settings" type="button" aria-label="Server settings">⚙</button>';
    const languageBar=document.querySelector('.language-bar');if(languageBar)languageBar.prepend(bar);else document.body.prepend(bar);
    document.getElementById('server-settings').onclick=()=>{if(native)native.configureServer();else{const value=prompt('Depot server HTTPS address',server);if(value!==null){try{const parsed=new URL(value);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error();sessionStorage.clear();localStorage.setItem('fleet_server',parsed.origin);location.href=FleetRemote.loginURL();}catch(_){status('Enter a valid server address',true);}}}};
    status(connected?'Connecting…':'Configure the depot server to sign in.',!connected);
    if(connected&&!token)warmup().catch(()=>{});
    if(connected&&token){FleetRemote.refresh();setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))FleetRemote.refresh();},15000);}
    window.addEventListener('online',()=>FleetRemote.refresh());
    window.addEventListener('offline',()=>{ready=false;status('Offline — reconnect before saving',true);});
  });
})();
