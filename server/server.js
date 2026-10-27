'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {openStorage}=require('./storage');
const {prepareNetwork,syncRoleRecords}=require('./admin-network');
const ROOT=path.resolve(__dirname,'..');
const ROLE_DB={entry:'EntryRecorder',cleaner:'Cleaner',charging:'Charging'};
const STATE_KEYS=['sfos_multi_v2','smart_fleet_db_entry_recorder','smart_fleet_db_cleaner','smart_fleet_db_charging','smart_fleet_db_scheduler','smart_fleet_issues'];
const dataCode=fs.readFileSync(path.join(ROOT,'src/data/app_data.js'),'utf8');
const dbCode=fs.readFileSync(path.join(ROOT,'src/js/database.js'),'utf8');
function runtime(store){
  const sandbox={console, setTimeout,clearTimeout,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},dispatchEvent(){},CustomEvent:function(){}};
  sandbox.window=sandbox;sandbox.global=sandbox;vm.createContext(sandbox);vm.runInContext(dataCode,sandbox);vm.runInContext('globalThis.baseFleet=FLEET;globalThis.schedules=SCHEDULES;globalThis.routes=ROUTES;',sandbox);vm.runInContext(dbCode,sandbox);return sandbox;
}
const hashToken=token=>crypto.createHash('sha256').update(token).digest('hex');
function passwordHash(password,salt=crypto.randomBytes(16).toString('hex')){return salt+':'+crypto.scryptSync(password,salt,64).toString('hex');}
function passwordMatches(password,stored){const [salt,hash]=stored.split(':');const expected=Buffer.from(hash,'hex'),actual=crypto.scryptSync(password,salt,64);return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}
async function makeServer(options={}){
  const directory=options.dataDir||process.env.FLEET_DATA_DIR||path.join(__dirname,'data');
  const db=await openStorage({...options,directory});
  const getState=(connection=db,lock=false)=>connection.prepare('SELECT body,revision FROM state WHERE id=1'+(lock&&db.dialect==='postgres'?' FOR UPDATE':'')).get();
  try { await db.transaction(async tx=>{
    if(db.dialect==='postgres')await tx.exec('SELECT pg_advisory_xact_lock(73691824)');
    await tx.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, role TEXT NOT NULL, depot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, expires BIGINT NOT NULL); CREATE TABLE IF NOT EXISTS requests (username TEXT NOT NULL, request_id TEXT NOT NULL, response TEXT NOT NULL, created BIGINT NOT NULL, PRIMARY KEY(username,request_id));');
    if(await getState(tx))return;
    const adminPassword=options.adminPassword||process.env.FLEET_ADMIN_PASSWORD;
    if(db.dialect==='postgres'&&String(adminPassword||'').length<14)throw new Error('Set FLEET_ADMIN_PASSWORD to at least 14 characters for the first cloud startup.');
    const store={},ctx=runtime(store);
    const depot={id:'chandapura',name:'Chandapura Depot 44',city:'Bengaluru',lat:12.8,lon:77.7,routes:ctx.routes.map(r=>r.id),drivers:[...new Set(ctx.baseFleet.map(b=>b.driver).filter(Boolean))],users:{}};
    store.sfos_multi_v2=JSON.stringify({depots:[depot],buses:ctx.baseFleet.map(b=>({...JSON.parse(JSON.stringify(b)),id:b.id||b.busId,reg:b.reg||b.regNo,home:'chandapura',loc:'chandapura',linkedDepots:['chandapura'],entry:false,clean:false,charge:false,route:'',driver:''})),log:[]});
    store.smart_fleet_issues='[]';
    await tx.prepare('INSERT INTO state VALUES (1,?,0)').run(JSON.stringify(store));
    const initial=[];
    // Cloud staff passwords are set by Admin, not written to Render's temporary filesystem.
    for(const role of db.dialect==='postgres'?['admin']:['admin','entry','cleaner','charging','scheduler','manager']){
      const username=role==='admin'?'admin':'chandapura-'+role;
      const password=role==='admin'&&adminPassword?adminPassword:crypto.randomBytes(12).toString('base64url');
      await tx.prepare('INSERT INTO users VALUES (?,?,?,?)').run(username,passwordHash(password),role,'chandapura');initial.push({username,password,role,depot:'chandapura'});
    }
    if(db.dialect==='sqlite')fs.writeFileSync(path.join(directory,'initial-access.json'),JSON.stringify({note:'Private first-run credentials. Change passwords before operational use. The initial fleet is bundled sample data.',accounts:initial},null,2),{mode:0o600});
  }); } catch(error) { await db.close();throw error; }
  const limits=new Map();
  async function snapshot(user){
    const {body,revision}=await getState(),store=JSON.parse(body);
    if(user.role!=='admin'){
      const multi=JSON.parse(store.sfos_multi_v2);multi.depots=multi.depots.filter(d=>d.id===user.depot).map(d=>({...d,users:{}}));
      multi.buses=multi.buses.filter(b=>b.loc===user.depot||(b.linkedDepots||[]).includes(user.depot));multi.log=(multi.log||[]).filter(l=>(l.d||[]).includes(user.depot));store.sfos_multi_v2=JSON.stringify(multi);
      for(const key of STATE_KEYS.filter(k=>k.startsWith('smart_fleet_db_'))){const rows=JSON.parse(store[key]||'{}');store[key]=JSON.stringify(Object.fromEntries(Object.entries(rows).filter(([,row])=>(row.depotId||'chandapura')===user.depot)));}
      store.smart_fleet_issues=JSON.stringify(JSON.parse(store.smart_fleet_issues||'[]').filter(i=>i.depotId===user.depot));
    }
    const clean=JSON.parse(store.sfos_multi_v2);clean.depots.forEach(d=>{d.users={};});store.sfos_multi_v2=JSON.stringify(clean);
    return {revision,store:Object.fromEntries(STATE_KEYS.map(k=>[k,store[k]|| (k==='smart_fleet_issues'?'[]':'{}')]))};
  }
  function respond(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  async function readBody(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>2_000_000)throw Object.assign(new Error('Request is too large'),{status:413});}try{return JSON.parse(body||'{}');}catch{throw Object.assign(new Error('Invalid request'),{status:400});}}
  function fail(message,status=400){throw Object.assign(new Error(message),{status});}
  async function transact(user,action,tx){
    const current=await getState(tx),store=JSON.parse(current.body),ctx=runtime(store),api=ctx.FleetDB;
    const {busId}=action;
    const multi=JSON.parse(store.sfos_multi_v2),bus=multi.buses.find(b=>b.id===busId);
    const depot=user.role==='admin'?(action.depotId||bus?.loc||user.depot):user.depot;
    if(!bus||(!(bus.linkedDepots||[]).includes(depot)&&bus.loc!==depot))fail('Bus is not available at your depot',403);
    if(action.action!=='approve'&&bus.loc!==depot)fail('Bus is not at your depot',403);
    if(action.action==='approve'){
      if(!ROLE_DB[user.role])fail('This role cannot approve work',403);
      api[ROLE_DB[user.role]].approveBus(busId,user.username,depot);
    }else if(action.action==='report'){
      if(!['entry','cleaner','charging','manager','admin'].includes(user.role))fail('This role cannot report a problem',403);
      api.Issues.report(busId,depot,user.role,String(action.reason||'').slice(0,150),String(action.notes||'').slice(0,500),user.username);
    }else if(action.action==='resolve'){
      if(!['manager','admin'].includes(user.role))fail('Manager access required',403);
      api.Issues.resolve(action.issueId,depot,String(action.resolution||'').slice(0,500),user.username);
    }else if(action.action==='assign'){
      if(user.role!=='scheduler')fail('Scheduler access required',403);
      if(!bus.entry||!bus.clean||!bus.charge||bus.maintenance)fail('Bus has not completed entry, cleaning and charging');
      api.Scheduler.assignBus(busId,action.scheduleId,action.driverName,{depotId:depot,schedules:ctx.schedules,fleet:ctx.baseFleet});
    }else if(action.action==='return'){
      if(!['manager','admin'].includes(user.role))fail('Manager access required',403);
      if(!api.Scheduler.getAssignments().some(b=>b.busId===busId))fail('Bus is not assigned');
      api.Scheduler.returnToDepot(busId);
    }else fail('Unknown action');
    await tx.prepare('UPDATE state SET body=?,revision=revision+1 WHERE id=1').run(JSON.stringify(store));
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const origin=req.headers.origin;
    const allowedOrigin=Boolean(origin)&&(origin==='https://appassets.androidplatform.net'||origin===process.env.FLEET_WEB_ORIGIN);
    if(allowedOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
    if(req.method==='OPTIONS'){res.writeHead(allowedOrigin?204:403);res.end();return;}
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/health')return respond(res,200,{ok:true});
      if(url.pathname==='/api/login'&&req.method==='POST'){
        const ip=req.socket.remoteAddress,now=Date.now(),attempt=limits.get(ip)||{count:0,until:now+900000};if(attempt.until<now){attempt.count=0;attempt.until=now+900000;}attempt.count++;limits.set(ip,attempt);if(attempt.count>30)fail('Too many attempts. Try again later.',429);
        const body=await readBody(req),username=String(body.username||'').trim().toLowerCase(),user=await db.prepare('SELECT * FROM users WHERE username=?').get(username);
        if(!user||!passwordMatches(String(body.password||''),user.password)||body.role&&body.role!==user.role)fail('Invalid user ID or password.',401);
        limits.delete(ip);const token=crypto.randomBytes(32).toString('base64url');await db.prepare('DELETE FROM sessions WHERE expires<?').run(now);await db.prepare('DELETE FROM requests WHERE created<?').run(now-86400000);await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hashToken(token),username,now+43200000);
        return respond(res,200,{token,session:{id:user.role,u:username,depot:user.depot},...(await snapshot(user))});
      }
      if(url.pathname.startsWith('/api/')){
        const token=(req.headers.authorization||'').replace(/^Bearer /,'');
        const user=await db.prepare('SELECT users.* FROM users JOIN sessions ON users.username=sessions.username WHERE sessions.token=? AND sessions.expires>?').get(hashToken(token),Date.now());
        if(!user)fail('Sign in again to continue',401);
        if(url.pathname==='/api/logout'&&req.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token=?').run(hashToken(token));return respond(res,200,{ok:true});}
        if(url.pathname==='/api/state'&&req.method==='GET'){const current=await db.prepare('SELECT revision FROM state WHERE id=1').get();if(url.searchParams.get('since')===String(current.revision))return respond(res,200,{revision:current.revision,unchanged:true});return respond(res,200,await snapshot(user));}
        if(url.pathname==='/api/action'&&req.method==='POST'){
          const body=await readBody(req);if(typeof body.requestId!=='string'||body.requestId.length>100||body.requestId.length<10)fail('Missing request identifier');
          const replayed=await db.transaction(async tx=>{
            await getState(tx,true);
            const old=await tx.prepare('SELECT response FROM requests WHERE username=? AND request_id=?').get(user.username,body.requestId);
            if(old)return true;
            await transact(user,body,tx);
            await tx.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(user.username,body.requestId,'ok',Date.now());
            return false;
          });
          return respond(res,200,{ok:true,...(await snapshot(user)),...(replayed?{replayed:true}:{})});
        }
        if(url.pathname==='/api/admin/network'&&req.method==='POST'&&user.role==='admin'){
          const body=await readBody(req);
          await db.transaction(async tx=>{
            const current=await getState(tx,true);
            if(body.revision!==current.revision)fail('Depot data changed. Refresh and try again.',409);
            const store=JSON.parse(current.body),previous=JSON.parse(store.sfos_multi_v2);
            const change=prepareNetwork(body.network,previous);
            const admins=await tx.prepare("SELECT depot FROM users WHERE role='admin'").all();
            if(admins.some(a=>change.removedDepots.includes(a.depot)))fail('Move admin accounts to another depot before deleting this depot');
            for(const account of change.accounts){
              if(await tx.prepare('SELECT username FROM users WHERE username=?').get(account.username))fail('A generated username already exists');
              await tx.prepare('INSERT INTO users VALUES (?,?,?,?)').run(account.username,passwordHash(account.password),account.role,account.depot);
            }
            for(const depot of change.removedDepots){
              await tx.prepare('DELETE FROM sessions WHERE username IN (SELECT username FROM users WHERE depot=?)').run(depot);
              await tx.prepare('DELETE FROM users WHERE depot=?').run(depot);
            }
            syncRoleRecords(store,change.network,change.reset);
            store.sfos_multi_v2=JSON.stringify(change.network);
            await tx.prepare('UPDATE state SET body=?,revision=revision+1 WHERE id=1').run(JSON.stringify(store));
          });
          return respond(res,200,{ok:true,...await snapshot(user)});
        }
        if(url.pathname==='/api/admin/users'&&user.role==='admin'){
          if(req.method==='GET')return respond(res,200,{users:await db.prepare('SELECT username,role,depot FROM users ORDER BY username').all()});
          if(req.method==='POST'){
            const body=await readBody(req),username=String(body.username||'').trim().toLowerCase(),role=body.role,depot=body.depot||'chandapura';
            if(!/^[a-z0-9_-]{3,60}$/.test(username)||!['entry','cleaner','charging','scheduler','manager','admin'].includes(role)||String(body.password||'').length<8||String(body.password||'').length>200)fail('Use a valid username and a password of 8 to 200 characters');
            if(!JSON.parse(JSON.parse((await getState()).body).sfos_multi_v2).depots.some(d=>d.id===depot))fail('Unknown depot');
            if(username===user.username&&(role!=='admin'||depot!==user.depot))fail('You cannot remove your own admin access');
            await db.transaction(async tx=>{await tx.prepare('INSERT INTO users VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET password=excluded.password,role=excluded.role,depot=excluded.depot').run(username,passwordHash(body.password),role,depot);await tx.prepare('DELETE FROM sessions WHERE username=?').run(username);});return respond(res,200,{ok:true});
          }
        }
        fail('Endpoint not found',404);
      }
      if(!['GET','HEAD'].includes(req.method))fail('Method not allowed',405);
      const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');
      if(!(/^(index|entry_recorder|cleaner|charging|scheduler|manager|admin|mobile_admin)\.html$/.test(relative)||/^src\/(js\/[\w-]+\.js|css\/[\w-]+\.css|data\/app_data\.js)$/.test(relative)||/^assets\/[\w/.-]+\.(png|svg)$/.test(relative)))fail('Not found',404);
      const filename=path.resolve(ROOT,relative);if(!filename.startsWith(ROOT+path.sep))fail('Not found',404);
      const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(filename)]||'text/plain';
      res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache'});let content=fs.readFileSync(filename);if(path.extname(filename)==='.html')content=content.toString('utf8').replace('<head>','<head><meta name="fleet-api" content="same-origin">');res.end(req.method==='HEAD'?'':content);
    }catch(error){if(!res.headersSent)respond(res,error.status||400,{error:error.code==='ENOENT'?'Not found':error.message});else res.end();}
  });
  server.storageKind=db.dialect;
  server.on('close',()=>{server.storageClosed=db.close();});return server;
}
if(require.main===module){
  makeServer().then(server=>{
    server.listen(Number(process.env.PORT||8787),process.env.FLEET_HOST||'127.0.0.1',()=>console.log('Fleet server ready. Storage: '+server.storageKind+'. Cloud admin uses the configured FLEET_ADMIN_PASSWORD.'));
    const shutdown=()=>server.close(async()=>{await server.storageClosed;process.exit(0);});
    process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  }).catch(()=>{console.error('Fleet startup failed. Check database connectivity and required server secrets; no local cloud fallback is enabled.');process.exitCode=1;});
}
module.exports={makeServer};
