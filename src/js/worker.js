/* Shared role screens. Operational data stays in FleetDB. */
(() => {
  'use strict';
  const role = document.body.dataset.role;
  const meta = {
    entry: { title: 'Bus entry', instruction: 'Tap the bus that has arrived.', action: 'Bus entered', icon: '→', db: 'EntryRecorder', flag: 'entryApproved', time: 'approvedAt' },
    cleaner: { title: 'Cleaning', instruction: 'Tap the bus you have finished cleaning.', action: 'Cleaning done', icon: '✦', db: 'Cleaner', flag: 'cleanApproved', time: 'cleanedAt' },
    charging: { title: 'Charging', instruction: 'Tap the bus you have finished charging.', action: 'Charging done', icon: 'ϟ', db: 'Charging', flag: 'chargeApproved', time: 'chargedAt' },
    manager: { title: 'Depot manager', instruction: 'Review your depot and resolve reported problems.' }
  }[role];
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = '<svg class="bus-icon" aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><rect x="10" y="9" width="44" height="43" rx="8"/><path d="M11 32h42M31 11v21M16 52v6m32-6v6"/><circle cx="21" cy="42" r="3"/><circle cx="43" cy="42" r="3"/></svg>';
  let session, depotId, pending = [], selected = '', busy = false, pageIndex = 0;
  const pageSize = 6;
  try { session = JSON.parse(sessionStorage.getItem('fleet_session') || 'null'); } catch (_) {}
  depotId = new URLSearchParams(location.search).get('depotId') || session?.depot || 'chandapura';
  if (!session || session.id !== role || session.depot !== depotId) { location.replace(window.FleetRemote?.loginURL()||'index.html'); return; }
  function central() { return JSON.parse(localStorage.getItem('sfos_multi_v2') || '{"depots":[],"buses":[]}'); }
  function depotName() { return central().depots?.find(d => d.id === depotId)?.name || depotId; }
  async function signOut() {
    await window.FleetRemote?.logout();
    sessionStorage.removeItem('fleet_session');
    sessionStorage.removeItem('auth_token'); sessionStorage.removeItem('auth_role');
    if (parent !== window) parent.postMessage({ type: 'sfr:logout' }, location.origin);
    else location.replace(window.FleetRemote?.loginURL()||'index.html');
  }
  function notice(message, error = false) { $('notice').className = 'notice' + (error ? ' error' : ''); $('notice').textContent = message; if (error) $('notice').focus(); }
  function busInfo(id) {
    const local = central().buses?.find(b => (b.id || b.busId) === id);
    // An Admin record is more current than the bundled demonstration data.
    return local || FLEET.find(b => (b.id || b.busId) === id) || {};
  }
  function readableTime(value) { return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function details(bus) {
    if (role !== 'charging') return '';
    const b = busInfo(bus.busId), isDemo = !central().buses?.some(x => (x.id || x.busId) === bus.busId);
    return `<p>Battery: <strong>${Number.isFinite(b.soc) ? esc(b.soc) + '%' : 'Not recorded'}</strong> · Charger: <strong>${esc(b.chargerBay ?? 'Not recorded')}</strong></p><p class="small">${isDemo ? 'Battery information is from the bundled sample data. ' : ''}No live charger connection. Check the charger display before confirming.</p>`;
  }
  document.body.classList.toggle('dark-mode', localStorage.getItem('fleet_theme') === 'dark');
  document.body.innerHTML = `<header><div><strong>Smart Fleet</strong><p id="depot-name"></p></div><div class="header-actions"><button id="theme" aria-label="Change colour theme">◐</button><button id="signout">Sign out</button></div></header><main><h1>${esc(meta.title)}</h1><p class="intro">${esc(meta.instruction)}</p><div id="notice" class="notice" role="status" aria-live="polite" aria-atomic="true" tabindex="-1"></div><div id="content"></div><p class="small">Saved on this browser only. Other phones do not receive these updates.</p></main><dialog id="confirm-dialog" aria-labelledby="confirm-title"></dialog><dialog id="problem-dialog" aria-labelledby="problem-title"></dialog><div id="scannerLayer"></div>`;
  $('signout').onclick = signOut;
  if(window.FleetRemote?.enabled)document.querySelector('main > p.small').textContent='Connected to the depot server.';
  if ('speechSynthesis' in window || window.FleetAndroid?.speak) {
    const listen = document.createElement('button'); listen.textContent = '▶ Listen';
    listen.onclick = () => {
      const bus = pending.find(b => b.busId === selected);
      const translate=window.FleetI18n?.t||((v)=>v);
      const message = bus ? `${translate(meta.title)}. ${bus.busId}. ${bus.regNo}. ${translate(meta.action)}.` : `${translate(meta.title)}. ${translate(meta.instruction || '')}`;
      if(window.FleetAndroid?.speak){if(!FleetAndroid.speak(message,window.FleetI18n?.locale||'en-IN'))notice('Audio is not available in this language on this phone.',true);return;}
      speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(message); speech.text = window.FleetI18n?.t(message)||message; speech.lang = window.FleetI18n?.locale||'en-IN'; speech.rate = 0.85; speechSynthesis.speak(speech);
    };
    document.querySelector('.intro').after(listen);
    window.addEventListener('pagehide', () => {if(window.FleetAndroid?.stopSpeaking)FleetAndroid.stopSpeaking();else speechSynthesis.cancel();});
  }
  $('theme').onclick = () => { const dark = document.body.classList.toggle('dark-mode'); localStorage.setItem('fleet_theme', dark ? 'dark' : 'light'); if (parent !== window) parent.postMessage({ type: 'sfr:theme', value: dark ? 'dark' : 'light' }, location.origin); };
  function start() {
    $('depot-name').textContent = depotName();
    if (role === 'manager') return renderManager();
    $('content').innerHTML = `<div class="queue-head"><h2>Choose a bus</h2><span id="pending-count" class="count"></span></div><label for="bus-search">Bus number or registration</label><div class="search-row"><input id="bus-search" type="search" placeholder="Example: 304 or KA51AJ0137" autocomplete="off">${role === 'entry' ? '<button id="scan">▣ Scan plate</button>' : ''}<button id="refresh" aria-label="Refresh bus list">↻ Refresh</button></div><div id="bus-list" class="bus-grid"></div><section id="selection" aria-label="Selected bus"></section><section class="panel"><h2>Recently completed</h2><ul id="recent" class="recent"></ul><p class="small">For a correction, contact your depot manager. Approvals are not reversed automatically.</p></section>`;
    $('bus-search').oninput = () => { selected = ''; pageIndex = 0; renderQueue(); };
    $('refresh').onclick = async () => {await window.FleetRemote?.refresh();refresh();};
    if ($('scan')) $('scan').onclick = () => window.openScanner();
    refresh();
  }
  function refresh() {
    try {
      if (!window.FleetDB) throw new Error('Bus data is unavailable');
      if (role === 'manager') return renderManager();
      pending = FleetDB[meta.db].getPending(depotId);
      if (!pending.some(b => b.busId === selected)) selected = '';
      renderQueue(); renderRecent();
    } catch (_) {
      pending = []; selected = '';
      if ($('bus-list')) { $('bus-list').innerHTML = ''; $('selection').innerHTML = ''; }
      notice('Could not load buses. Use Refresh to try again.', true);
    }
  }
  function renderQueue() {
    const query = $('bus-search').value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rows = pending.filter(b => (b.busId + b.regNo).toLowerCase().replace(/[^a-z0-9]/g, '').includes(query));
    pageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
    const visible = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    $('pending-count').textContent = `${pending.length} waiting`;
    $('bus-list').innerHTML = rows.length ? visible.map(b => `<button class="bus-card" data-bus="${esc(b.busId)}" aria-pressed="${selected === b.busId}">${icon}<span><strong class="bus-number">${esc(b.busId)}</strong><span class="registration">${esc(b.regNo)}</span>${FleetDB.Issues.isHeld(b.busId) ? '<span class="badge">⚠ Problem reported · On hold</span>' : ''}</span></button>`).join('') + (rows.length > pageSize ? `<nav class="pagination" aria-label="Bus list pages"><button id="previous-buses" ${pageIndex === 0 ? 'disabled' : ''}>← Previous</button><span>${pageIndex * pageSize + 1}–${Math.min(rows.length, (pageIndex + 1) * pageSize)} of ${rows.length}</span><button id="next-buses" ${(pageIndex + 1) * pageSize >= rows.length ? 'disabled' : ''}>Next →</button></nav>` : '') : `<div class="empty">${query ? 'No matching bus. Check the number or clear your search.' : '✓ No buses waiting. Refresh when the next bus arrives.'}</div>`;
    if ($('previous-buses')) $('previous-buses').onclick = () => { pageIndex--; renderQueue(); $('bus-search').focus(); };
    if ($('next-buses')) $('next-buses').onclick = () => { pageIndex++; renderQueue(); $('bus-search').focus(); };
    $('bus-list').querySelectorAll('[data-bus]').forEach(button => button.onclick = () => { selected = button.dataset.bus; renderQueue(); $('selection').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    const bus = pending.find(b => b.busId === selected);
    $('selection').innerHTML = bus ? `<div class="selection"><h2>Selected bus: ${esc(bus.busId)}</h2><p class="registration">${esc(bus.regNo)}</p>${details(bus)}${FleetDB.Issues.isHeld(bus.busId) ? '<p>⚠ This bus is on hold. Ask the depot manager to review the problem.</p>' : ''}<div class="actions"><button class="primary" id="approve" ${FleetDB.Issues.isHeld(bus.busId) ? 'disabled' : ''}>✓ ${esc(meta.action)}</button><button class="danger" id="report">⚠ Report problem</button></div></div>` : '';
    if (bus) { $('approve').onclick = () => confirmBus(bus); $('report').onclick = () => reportProblem(bus); }
  }
  function renderRecent() {
    const rows = FleetDB[meta.db].getAll().filter(b => b[meta.flag] && (b.depotId || 'chandapura') === depotId).sort((a, b) => String(b[meta.time]).localeCompare(String(a[meta.time]))).slice(0, 8);
    $('recent').innerHTML = rows.length ? rows.map(b => `<li><div><strong>✓ ${esc(b.busId)}</strong><br><span>${esc(b.regNo)}</span></div><span>${esc(readableTime(b[meta.time]))}</span></li>`).join('') : '<li>No completed buses yet.</li>';
  }
  function confirmBus(bus) {
    const dialog = $('confirm-dialog');
    dialog.innerHTML = `<h2 id="confirm-title">${esc(meta.action)}?</h2>${icon}<strong class="bus-number">${esc(bus.busId)}</strong><p class="registration">${esc(bus.regNo)}</p><p>Check that this is the correct bus.</p>${details(bus)}<div class="actions"><button class="primary" id="confirm-save">Yes, save</button><button id="cancel-save">Go back</button></div>`;
    $('cancel-save').onclick = () => dialog.close();
    $('confirm-save').onclick = async () => {
      if (busy) return; busy = true; $('confirm-save').disabled = true;
      try {
        if (!FleetDB[meta.db].getPending(depotId).some(b => b.busId === bus.busId)) throw new Error('This bus has already changed. Refresh and choose again.');
        if (FleetDB.Issues.isHeld(bus.busId)) throw new Error('This bus has a reported problem. Ask the manager to review it.');
        if(window.FleetRemote?.enabled)await FleetRemote.perform('approve',{busId:bus.busId});
        else FleetDB[meta.db].approveBus(bus.busId, session.u, depotId);
        dialog.close(); selected = ''; $('bus-search').value = ''; refresh();
        notice(`✓ ${bus.busId} · ${meta.action} saved.`); $('notice').focus();
      } catch (error) { dialog.close(); refresh(); notice(error.confirmationUnknown?'Save could not be confirmed. Refresh to check recent work.':`Not saved. ${error.message}`, true); }
      finally { busy = false; }
    };
    dialog.showModal(); $('cancel-save').focus();
  }
  function reportProblem(bus) {
    const dialog = $('problem-dialog');
    dialog.innerHTML = `<h2 id="problem-title">Report problem · ${esc(bus.busId)}</h2><p>${esc(bus.regNo)}</p><p>The bus will be held for manager review.</p><label for="reason">What is wrong?</label><select id="reason"><option>Bus needs repair</option><option>Cleaning incomplete</option><option>Charger not working</option><option>Battery not ready</option><option>Wrong bus details</option><option>Other problem</option></select><label for="notes">More details (optional)</label><textarea id="notes" maxlength="500"></textarea><div class="actions"><button id="save-problem" class="primary">Save problem</button><button id="cancel-problem">Go back</button></div>`;
    $('cancel-problem').onclick = () => dialog.close();
    $('save-problem').onclick = async () => {
      try { if(window.FleetRemote?.enabled)await FleetRemote.perform('report',{busId:bus.busId,reason:$('reason').value,notes:$('notes').value});else FleetDB.Issues.report(bus.busId, depotId, role, $('reason').value, $('notes').value, session.u); dialog.close(); refresh(); notice(`⚠ ${bus.busId} · Problem saved. Ask your depot manager to review it.`); $('notice').focus(); }
      catch (_) { notice('Problem not saved. Please try again.', true); }
    };
    dialog.showModal();
  }
  function renderManager() {
    const issues = FleetDB.Issues.getAll().filter(i => i.depotId === depotId && !i.resolvedAt);
    const counts = [['Entry', FleetDB.EntryRecorder.getPending(depotId).length], ['Cleaning', FleetDB.Cleaner.getPending(depotId).length], ['Charging', FleetDB.Charging.getPending(depotId).length], ['Ready', FleetDB.Scheduler.getReadyPool(depotId).length], ['Assigned', FleetDB.Scheduler.getAssignments().filter(b => b.depotId === depotId).length], ['Problems', issues.length]];
    $('content').innerHTML = `<div class="metrics">${counts.map(([name, count]) => `<div class="metric"><strong>${count}</strong>${name}</div>`).join('')}</div><div class="panel"><div class="queue-head"><h2>Reported problems</h2><button id="refresh">↻ Refresh</button></div><p class="small">Resolve only after checking the bus. Resolving a problem removes its hold; it does not approve any work.</p>${issues.length ? issues.map(i => `<div class="issue"><strong>${esc(i.busId)} · ${esc(i.reason)}</strong><p>${esc(i.notes)}</p><p class="small">${esc(i.role)} · ${esc(i.operator)} · ${esc(readableTime(i.createdAt))}</p><button data-resolve="${esc(i.id)}">Review and resolve</button></div>`).join('') : '<p>✓ No open problems.</p>'}</div>`;
    $('refresh').onclick = async () => {await window.FleetRemote?.refresh();refresh();};
    const assigned=FleetDB.Scheduler.getAssignments().filter(b=>(b.depotId||'chandapura')===depotId);
    if(assigned.length){
      const panel=document.createElement('section');panel.className='panel';panel.innerHTML='<h2>Assigned buses</h2>'+assigned.map(b=>`<div class="issue"><strong>${esc(b.busId)}</strong><p>${esc(b.scheduleAssigned)} · ${esc(b.assignedDriver)}</p><button data-return="${esc(b.busId)}">Bus returned</button></div>`).join('');$('content').append(panel);
      panel.querySelectorAll('[data-return]').forEach(button=>button.onclick=()=>{
        const dialog=$('confirm-dialog');dialog.innerHTML=`<h2 id="confirm-title">Confirm bus return</h2><strong class="bus-number">${esc(button.dataset.return)}</strong><p>Return this bus only after it has physically arrived at the depot.</p><div class="actions"><button id="return-save" class="primary">Yes, save</button><button id="return-cancel">Go back</button></div>`;
        $('return-cancel').onclick=()=>dialog.close();$('return-save').onclick=async()=>{try{if(window.FleetRemote?.enabled)await FleetRemote.perform('return',{busId:button.dataset.return});else FleetDB.Scheduler.returnToDepot(button.dataset.return);dialog.close();refresh();notice('Bus returned');}catch(error){notice(error.message,true);}};dialog.showModal();$('return-cancel').focus();
      });
    }
    $('content').querySelectorAll('[data-resolve]').forEach(button => button.onclick = () => {
      const dialog = $('problem-dialog');
      dialog.innerHTML = '<h2 id="problem-title">Resolve reported problem</h2><label for="resolution">What was checked or corrected?</label><textarea id="resolution" maxlength="500"></textarea><div class="actions"><button id="resolve-save" class="primary">Resolve problem</button><button id="resolve-cancel">Go back</button></div>';
      $('resolve-cancel').onclick = () => dialog.close();
      $('resolve-save').onclick = async () => { if (!$('resolution').value.trim()) { $('resolution').focus(); return; } try { if(window.FleetRemote?.enabled){const issue=FleetDB.Issues.getAll().find(i=>i.id===button.dataset.resolve);await FleetRemote.perform('resolve',{busId:issue.busId,issueId:issue.id,resolution:$('resolution').value});}else FleetDB.Issues.resolve(button.dataset.resolve, depotId, $('resolution').value, session.u); dialog.close(); refresh(); notice('✓ Problem resolved. The worker can review the bus again.'); } catch (error) { notice(error.message, true); } };
      dialog.showModal();
    });
  }
  // Adapter for the shared plate scanner; scanning never approves a bus.
  window.workerQueue = () => pending;
  window.workerSelectScanned = id => { selected = id; $('bus-search').value = ''; pageIndex = Math.max(0, Math.floor(pending.findIndex(b => b.busId === id) / pageSize)); renderQueue(); $('selection').scrollIntoView({ block: 'nearest' }); };
  window.addEventListener('storage', event => {
    if (!event.key || event.key.startsWith('smart_fleet_') || event.key === 'sfos_multi_v2') refresh();
    if (event.key === 'fleet_theme') document.body.classList.toggle('dark-mode', event.newValue === 'dark');
  });
  window.addEventListener('fleet-db-updated', () => { if (!busy) refresh(); });
  window.addEventListener('focus', refresh);
  try { start(); } catch (_) { notice('Could not load this screen. Reload the page to try again.', true); }
})();
