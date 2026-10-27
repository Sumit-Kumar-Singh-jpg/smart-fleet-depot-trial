document.addEventListener('DOMContentLoaded',async()=>{
  'use strict';
  const session=JSON.parse(sessionStorage.getItem('fleet_session')||'null');
  if(session?.id!=='admin'||!window.FleetRemote?.enabled){location.replace('index.html?app=admin');return;}
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=JSON.parse(localStorage.getItem('sfos_multi_v2')||'{}');
  $('account-depot').innerHTML=(state.depots||[]).map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
  async function refresh(){try{const result=await FleetRemote.users();$('users').innerHTML=result.users.map(u=>`<p><strong>${esc(u.username)}</strong><br>${esc(u.role)} · ${esc(u.depot)}</p>`).join('');}catch(error){$('admin-status').textContent=error.message;}}
  $('user-form').onsubmit=async event=>{event.preventDefault();try{await FleetRemote.saveUser({username:$('username').value,password:$('new-password').value,role:$('account-role').value,depot:$('account-depot').value});$('new-password').value='';$('admin-status').textContent='Account saved. Previous sessions for this account have ended.';await refresh();}catch(error){$('admin-status').textContent=error.message;}};
  $('admin-signout').onclick=async()=>{await FleetRemote.logout();sessionStorage.clear();location.replace('index.html?app=admin');};
  await refresh();
});
