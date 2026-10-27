'use strict';

// Persist configuration from the original Admin dashboard. Workflow approvals
// stay owned by the role APIs; a stale dashboard cannot overwrite newer work.
function prepareNetwork(input, previous) {
  const reject = message => { throw Object.assign(new Error(message), {status:400}); };
  if (!input || !Array.isArray(input.depots) || !Array.isArray(input.buses) ||
      input.depots.length < 1 || input.depots.length > 200 || input.buses.length > 20000) reject('Invalid depot or fleet data');
  const text = (value, max=150) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[<>\x00-\x1f]/.test(value);
  const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(value);
  const unique = values => new Set(values.map(v=>v.toLowerCase())).size === values.length;
  const list = values => Array.isArray(values) && values.length <= 2000 && values.every(v=>text(v)) && unique(values);
  if (!input.depots.every(d=>identifier(d.id) && text(d.name) && text(d.city) && list(d.routes) && list(d.drivers)) ||
      !unique(input.depots.map(d=>d.id))) reject('Use unique depots, schedules and drivers');
  const depotIds = new Set(input.depots.map(d=>d.id));
  const oldDepots = new Set(previous.depots.map(d=>d.id));
  const oldBuses = new Map(previous.buses.map(b=>[b.id,b]));
  if (!input.buses.every(b=>identifier(b.id) && text(b.reg,60) && (!b.cat || ['A','B','C'].includes(b.cat)) &&
      Array.isArray(b.linkedDepots) && b.linkedDepots.every(d=>depotIds.has(d))) ||
      !unique(input.buses.map(b=>b.id)) || !unique(input.buses.map(b=>b.reg))) reject('Use unique bus codes and registrations linked to valid depots');
  if (previous.buses.some(b=>!input.buses.some(n=>n.id===b.id))) reject('Existing physical fleet records cannot be removed');
  const reset = new Set();
  const workflow = ['entry','clean','charge','route','driver','loc','entryDepot','entryAt','transferTo','transferFrom','transferStatus'];
  const buses = input.buses.map(candidate=>{
    const old = oldBuses.get(candidate.id);
    if (!old) {
      if (!candidate.linkedDepots.length || !depotIds.has(candidate.home) || !depotIds.has(candidate.loc)) reject('New buses need a home depot');
      return {id:candidate.id,reg:candidate.reg,cat:candidate.cat||'B',home:candidate.home,loc:candidate.loc,
        linkedDepots:candidate.linkedDepots,entry:false,clean:false,charge:false,route:'',driver:'',maintenance:false,
        entryDepot:null,entryAt:null,transferTo:null,transferFrom:null,transferStatus:null};
    }
    const changed = {...old,reg:candidate.reg,cat:candidate.cat||old.cat||'B',home:candidate.home,
      linkedDepots:[...new Set(candidate.linkedDepots)]};
    if (changed.home && !depotIds.has(changed.home)) changed.home=changed.linkedDepots[0]||null;
    const removedLocation = old.loc && !depotIds.has(old.loc);
    const transferring = candidate.transferStatus==='in_transit' && candidate.transferTo &&
      (candidate.transferTo!==old.transferTo || candidate.transferFrom!==old.transferFrom);
    if (transferring || removedLocation) {
      if (transferring && (!depotIds.has(candidate.transferTo) || candidate.transferTo===old.loc || old.transferStatus==='in_transit')) reject('Choose a valid destination for this bus');
      Object.assign(changed,{entry:false,clean:false,charge:false,route:'',driver:'',loc:null,entryDepot:null,entryAt:null,
        transferFrom:transferring?old.loc:null,transferTo:transferring?candidate.transferTo:null,transferStatus:transferring?'in_transit':null});
      if (transferring && !changed.linkedDepots.includes(candidate.transferTo)) changed.linkedDepots.push(candidate.transferTo);
      reset.add(old.id);
    } else if (workflow.some(key=>(candidate[key]??null)!==(old[key]??null))) {
      reject('Use the staff consoles for approvals, assignments and bus returns');
    }
    if (old.entry && old.loc && depotIds.has(old.loc) && !changed.linkedDepots.includes(old.loc)) reject('Transfer or return a present bus before unlinking its depot');
    if (!changed.linkedDepots.length && !removedLocation) reject('Each bus needs an authorized depot');
    return changed;
  });
  for(const depot of input.depots){
    const before=previous.depots.find(d=>d.id===depot.id);
    if(buses.some(b=>b.loc===depot.id&&b.route&&((before?.routes.includes(b.route)&&!depot.routes.includes(b.route))||
      (before?.drivers.includes(b.driver)&&!depot.drivers.includes(b.driver))))) {
      reject('Return assigned buses before removing their schedules or drivers');
    }
  }
  const accounts=[];
  const roles={entry:'entry',clean:'cleaner',charge:'charging',sched:'scheduler',mgr:'manager'};
  const depots=input.depots.map(d=>{
    if (!oldDepots.has(d.id)) {
      for (const [key,role] of Object.entries(roles)) {
        const user=d.users?.[key];
        if (!user || !/^[a-z0-9_-]{3,60}$/.test(user.u) || typeof user.p!=='string' || user.p.length<8 || user.p.length>200) reject('New depots need five valid staff accounts');
        accounts.push({username:user.u,password:user.p,role,depot:d.id});
      }
    }
    return {id:d.id,name:d.name,city:d.city,lat:Number(d.lat)||0,lon:Number(d.lon)||0,routes:d.routes,drivers:d.drivers,users:{}};
  });
  const log=Array.isArray(input.log)?input.log.slice(0,300).map(item=>({t:String(item.t||'').slice(0,100),
    m:String(item.m||'').slice(0,1000),d:Array.isArray(item.d)?item.d.filter(d=>typeof d==='string'):[]})):previous.log;
  return {network:{depots,buses,log},accounts,reset,removedDepots:previous.depots.filter(d=>!depotIds.has(d.id)).map(d=>d.id)};
}

function syncRoleRecords(store, network, reset) {
  const buses=new Map(network.buses.map(b=>[b.id,b]));
  for (const key of ['smart_fleet_db_entry_recorder','smart_fleet_db_cleaner','smart_fleet_db_charging','smart_fleet_db_scheduler']) {
    const rows=JSON.parse(store[key]||'{}');
    for (const [id,row] of Object.entries(rows)) {
      const bus=buses.get(id);if (!bus) continue;
      if (reset.has(id)) {
        if (key!=='smart_fleet_db_entry_recorder') { delete rows[id];continue; }
        Object.assign(row,{entryApproved:false,approvedAt:null,operator:null,depotId:bus.transferTo||bus.home||'chandapura'});
      }
      row.regNo=bus.reg;row.cat=bus.cat;
    }
    store[key]=JSON.stringify(rows);
  }
}

module.exports={prepareNetwork,syncRoleRecords};
