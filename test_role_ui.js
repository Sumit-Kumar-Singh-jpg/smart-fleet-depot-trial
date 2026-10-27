// Browser regression tests. Run against a disposable local HTTP server.
// Requires Playwright and Microsoft Edge; no real user data is touched.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.FLEET_TEST_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  const page = await context.newPage();
  let checks = 0;
  const check = (ok, name) => { assert.ok(ok, name); checks++; console.log('PASS ' + name); };
  async function login(target, role) {
    await target.goto(base + '/index.html');
    await target.locator('#user').fill('test-' + role);
    await target.locator('#pass').fill('fixture-only');
    await Promise.all([target.waitForURL(url => !url.pathname.endsWith('/index.html')), target.locator('#loginForm button.primary').click()]);
    await target.waitForLoadState('domcontentloaded');
  }
  try {
    await page.goto(base + '/index.html');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('sfos_multi_v2', JSON.stringify({
        depots: [{ id: 'chandapura', name: 'Chandapura Depot 44', users: Object.fromEntries(['entry','clean','charge','sched','mgr'].map(r => [r, {u:'test-' + r,p:'fixture-only'}])) }],
        buses: [{id:'BM304',reg:'KA51AJ0137',cat:'C',actualRange:69.8,home:'chandapura',loc:'chandapura',linkedDepots:['chandapura'],entry:false,clean:false,charge:false}], log: []
      }));
    });
    await login(page, 'entry');
    await page.locator('[data-bus="BM304"]').waitFor();
    check(await page.locator('#approve').count() === 0, 'No approval before explicit bus selection');
    await page.locator('#bus-search').fill('304');
    check(await page.locator('#approve').count() === 0, 'Search does not auto-select a bus');
    await page.locator('[data-bus="BM304"]').click();
    await page.locator('#approve').click();
    check(await page.locator('#confirm-dialog').evaluate(d => d.open), 'Approval asks to confirm bus identity');
    await page.locator('#cancel-save').click();
    check(await page.evaluate(() => !FleetDB.EntryRecorder.init().BM304.entryApproved), 'Cancel preserves pending entry');
    await page.locator('#approve').click(); await page.locator('#confirm-save').click();
    check(await page.locator('#recent').innerText().then(t => t.includes('BM304')), 'Saved entry appears in recent work');
    const cleaner = await context.newPage(); await login(cleaner, 'clean');
    await cleaner.locator('[data-bus="BM304"]').click();
    await cleaner.locator('#report').click(); await cleaner.locator('#reason').selectOption('Cleaning incomplete'); await cleaner.locator('#save-problem').click();
    check(await cleaner.locator('#approve').isDisabled(), 'Reported problem disables worker approval');
    check(await cleaner.evaluate(() => { try { FleetDB.Cleaner.approveBus('BM304', 'fixture', 'chandapura'); return false; } catch (_) { return true; } }), 'Issue hold is enforced by FleetDB as well as the screen');
    check(await cleaner.evaluate(() => !FleetDB.Scheduler.getReadyPool('chandapura').some(b => b.busId === 'BM304')), 'Held bus excluded from scheduler pool');
    const manager = await context.newPage(); await login(manager, 'mgr');
    check(manager.url().includes('manager.html'), 'Depot Manager login opens manager screen');
    await manager.locator('[data-resolve]').click(); await manager.locator('#resolution').fill('Inspected bus; cleaning can continue.'); await manager.locator('#resolve-save').click();
    await cleaner.waitForFunction(() => !document.getElementById('approve').disabled);
    check(await cleaner.evaluate(() => !FleetDB.Cleaner.init().BM304.cleanApproved), 'Resolving a problem does not approve work');
    await cleaner.locator('#approve').click(); await cleaner.locator('#confirm-save').click();
    const charging = await context.newPage(); await login(charging, 'charge');
    await charging.locator('[data-bus="BM304"]').click();
    check(await charging.locator('#selection').innerText().then(t => t.includes('No live charger connection')), 'Charging screen labels data limitations');
    await charging.locator('#approve').click(); await charging.locator('#confirm-save').click();
    check(await charging.evaluate(() => { try { FleetDB.Charging.approveBus('BM304', 'fixture', 'chandapura'); return false; } catch (_) { return true; } }), 'Repeated approval is rejected before another write');
    check(await charging.evaluate(() => FleetDB.Scheduler.getReadyPool('chandapura').some(b => b.busId === 'BM304')), 'Both approvals enroll bus in ready pool');
    const scheduler = await context.newPage(); await login(scheduler, 'sched');
    await scheduler.locator('#scheduler-route-select').waitFor();
    check(scheduler.url().includes('scheduler.html'), 'Scheduler login works on first navigation');
    await scheduler.evaluate(() => {
      const data=JSON.parse(localStorage.getItem('smart_fleet_db_scheduler')); data.BM304.scheduleAssigned='fixture-trip'; data.BM304.assignedDriver='fixture-driver'; localStorage.setItem('smart_fleet_db_scheduler',JSON.stringify(data));
    });
    await scheduler.locator('.logout-btn').click(); await scheduler.waitForURL('**/index.html');
    check(await scheduler.evaluate(() => JSON.parse(localStorage.getItem('smart_fleet_db_scheduler')).BM304.scheduleAssigned === 'fixture-trip'), 'Signing out preserves assignments');
    await page.locator('#bus-search').fill('does-not-exist');
    check(await page.locator('#bus-list').innerText().then(t => t.includes('No matching bus')), 'Search failure has a clear empty state');
    await page.locator('#bus-search').fill('');
    check(await page.locator('.bus-card').count() <= 6, 'Phone queue uses short pages');
    await page.locator('#next-buses').click();
    check(await page.locator('#previous-buses').isEnabled(), 'Bus list pagination works');
    await page.locator('#scan').click();
    const scanBus = await page.evaluate(() => workerQueue()[0]);
    await page.locator('#scanText').fill(scanBus.regNo);
    await page.getByRole('button', { name: 'Match plate to bus', exact: true }).click();
    check(await page.locator('#selection').innerText().then(t => t.includes(scanBus.busId)), 'Plate matching selects an exact bus for review');
    check(await page.evaluate(id => !FleetDB.EntryRecorder.init()[id].entryApproved, scanBus.busId), 'Scanning never approves entry');
    for (const target of [page, cleaner, charging, manager]) {
      check(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow: ' + new URL(target.url()).pathname);
    }
    const screenshotPath = process.env.FLEET_SCREENSHOT_PATH;
    if (screenshotPath) {
      await page.locator('#bus-search').fill(''); await page.evaluate(() => scrollTo(0,0)); await page.screenshot({ path: screenshotPath, fullPage: false });
    }
    await page.setViewportSize({width:1280,height:900});
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Desktop layout fits the viewport');
    await manager.evaluate(() => FleetDB.Issues.report('BM304','chandapura','charging','Battery not ready','Fixture problem','test-charge'));
    check(await manager.locator('#content').innerText().then(t => t.includes('BM304')), 'Manager receives the current depot problem');
    check(await charging.evaluate(() => { try { FleetDB.Scheduler.assignBus('BM304','fixture-trip','fixture-driver',{depotId:'chandapura'}); return false; } catch (error) { return error.message.includes('unresolved reported problem'); } }), 'Held bus cannot bypass scheduling through a direct assignment call');
    const otherDepot = await context.newPage();
    await otherDepot.goto(base + '/index.html');
    await otherDepot.evaluate(() => sessionStorage.setItem('fleet_session',JSON.stringify({id:'manager',u:'other-manager',depot:'other-depot'})));
    await otherDepot.goto(base + '/manager.html?depotId=other-depot');
    check(await otherDepot.locator('#content').innerText().then(t => !t.includes('BM304')), 'Manager screen excludes problems in other depots');
    check(await otherDepot.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Storage full'); }; try { FleetDB.Issues.report('fixture-bus','other-depot','entry','Fixture','','fixture'); return false; } catch (_) { return true; } finally { Storage.prototype.setItem = original; } }), 'Failed report persistence is surfaced as an error');
    const unauthorized = await context.newPage(); await unauthorized.goto(base + '/cleaner.html?depotId=another-depot'); await unauthorized.waitForURL('**/index.html');
    check(unauthorized.url().endsWith('/index.html'), 'Role page rejects missing or mismatched session');
    check(errors.length === 0, 'No uncaught browser errors: ' + errors.join('; '));
    console.log(checks + ' browser checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
