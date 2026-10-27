// Keep the repository's Admin dashboard and send its changes to the server.
document.addEventListener('DOMContentLoaded',async()=>{
  'use strict';
  if(!window.FleetRemote?.enabled)return;
  let session;try{session=JSON.parse(sessionStorage.getItem('fleet_session')||'null');}catch(_){}
  if(session?.id!=='admin') { location.replace(FleetRemote.loginURL());return; }
  const roleMap={entry:'entry',clean:'cleaner',charge:'charging',sched:'scheduler',mgr:'manager'};
  let accounts=[],saving=false,proposed=false,viewRevision=null;
  const issued=new Map(),originalToast=window.toast;
  window.hydrateAdminUsers=()=>{
    for(const depot of S.depots){
      depot.users={};
      for(const [key,role] of Object.entries(roleMap)){
        const account=accounts.find(a=>a.depot===depot.id&&a.role===role);
        depot.users[key]={u:account?.username||'',p:account?(issued.get(account.username)||'••••••••'):'Not created'};
      }
    }
  };
  window.save=()=>{proposed=true;};
  window.toast=message=>{if(!saving)originalToast(message);};
  const draw=()=>{load();viewRevision=FleetRemote.revision;render();};
  async function refreshAccounts(){accounts=(await FleetRemote.users()).users;}
  for(const name of ['addDepot','addRes','remRes','editBus','linkBusAction','unlinkBus','tx','delDepot']){
    const action=window[name];
    window[name]=async(...args)=>{
      if(saving)return;
      saving=true;proposed=false;
      let message='Changes saved.';
      window.toast=value=>{message=value;};
      try{
        action(...args);
        if(!proposed){originalToast(message);return;}
        const candidate=JSON.parse(JSON.stringify(S)),revision=viewRevision;
        await FleetRemote.saveNetwork(candidate,revision);
        // Only newly generated passwords are shown, in this admin session.
        for(const depot of candidate.depots)for(const u of Object.values(depot.users||{})){
          if(u.u&&u.p&&!accounts.some(a=>a.username===u.u))issued.set(u.u,u.p);
        }
        await refreshAccounts();draw();originalToast(message==='Changes saved.'?'Changes saved.':message);
      }catch(error){
        await FleetRemote.refresh();draw();originalToast('Not saved. '+error.message);
      }finally{saving=false;window.toast=value=>originalToast(value);}
    };
  }
  window.act=()=>originalToast('Use the staff consoles for approvals, assignments and bus returns.');
  const randomPassword=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>v.toString(16).padStart(2,'0')).join('');
  window.regen=async key=>{
    if(saving)return;
    const depot=dep(curD()),account=accounts.find(a=>a.depot===depot?.id&&a.role===roleMap[key]);
    if(!account)return originalToast('Login not found');
    const password=prompt('Set password for '+account.username+' (at least 8 characters)',randomPassword());
    if(password===null)return;
    if(password.length<8||password.length>200)return originalToast('Use a password of 8 to 200 characters');
    saving=true;
    try{await FleetRemote.saveUser({...account,password});issued.set(account.username,password);draw();originalToast('Password updated.');}
    catch(error){originalToast('Not saved. '+error.message);}
    finally{saving=false;}
  };
  window.signOut=async()=>{
    if(saving)return;
    await FleetRemote.logout();sessionStorage.removeItem('fleet_session');
    if(parent!==window)parent.postMessage({type:'sfr:logout'},location.origin);
    else location.replace(FleetRemote.loginURL());
  };
  window.addEventListener('fleet-db-updated',()=>{
    if(!saving && !document.activeElement?.matches('input,select,textarea'))draw();
  });
  // A parent snapshot also updates this iframe's shared storage.
  window.addEventListener('storage',event=>{if(event.key===KEY&&!saving)draw();});
  try{await FleetRemote.refresh();await refreshAccounts();draw();}
  catch(error){document.getElementById('app').textContent=error.message;}
});
