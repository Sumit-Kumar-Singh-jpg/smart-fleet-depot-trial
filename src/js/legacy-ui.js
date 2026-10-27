// Connect the restored original forms to the existing cloud API.
document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  if(window.FleetAndroid&&self===top){
    document.body.setAttribute('data-native-app','');
    const header=document.querySelector('.right,.header-top,.header-actions');
    if(header){const button=document.createElement('button');button.type='button';button.className=header.matches('.right')?'act':'theme-toggle';button.textContent='Server settings';button.onclick=()=>FleetAndroid.configureServer();header.append(button);}
  }
  const role=document.body.dataset.role;
  if(!['entry','cleaner','charging'].includes(role))return;
  const database={entry:'EntryRecorder',cleaner:'Cleaner',charging:'Charging'}[role];
  const depot=new URLSearchParams(location.search).get('depotId')||'chandapura';
  let session;try{session=JSON.parse(sessionStorage.getItem('fleet_session')||'null');}catch(_){}
  if(!session||session.id!==role||session.depot!==depot){location.replace(window.FleetRemote?.loginURL()||'index.html');return;}
  let saving=false;
  const original=window.submitApproval;
  window.submitApproval=async()=>{
    if(!window.FleetRemote?.enabled)return original();
    if(saving)return;
    const select=document.getElementById('bus-select'),busId=select.value,button=document.getElementById('submit-btn');
    if(!busId)return showAlert('Please select a bus first.','error');
    saving=true;button.disabled=true;
    try{
      if(!FleetDB[database].getPending(depot).some(b=>b.busId===busId))throw new Error('This bus has already changed. Refresh and choose again.');
      await FleetRemote.perform('approve',{busId});
      document.getElementById('bus-search').value='';loadPendingBuses();
      showAlert('✓ Bus '+busId+' approved and saved.','success');
    }catch(error){showAlert(error.confirmationUnknown?'Save could not be confirmed. Refresh to check recent work.':'Not saved. '+error.message,'error');}
    finally{saving=false;button.disabled=!select.value;}
  };
  window.goToLogin=async()=>{
    await window.FleetRemote?.logout();sessionStorage.removeItem('fleet_session');sessionStorage.removeItem('auth_token');sessionStorage.removeItem('auth_role');
    if(parent!==window)parent.postMessage({type:'sfr:logout'},location.origin);
    else location.replace(window.FleetRemote?.loginURL()||'index.html');
  };
  window.addEventListener('storage',event=>{if(!event.key||event.key.startsWith('smart_fleet_')||event.key==='sfos_multi_v2')loadPendingBuses();});
});
