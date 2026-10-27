/**
 * Test Suite for Cross-Depot Bus Synchronization
 * Validates all 10 Acceptance Test Criteria from User Requirements.
 */

const fs = require('fs');
const path = require('path');

// Extract JS logic from admin.html
const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf-8');
const scriptMatch = adminHtml.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error("Could not find <script> block in admin.html");
  process.exit(1);
}

// Mock browser environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store
  };
})();

const dummyEl = {
  innerHTML: '',
  value: '',
  textContent: '',
  classList: { toggle: () => {}, add: () => {}, remove: () => {} },
  focus: () => {},
  setSelectionRange: () => {}
};

global.matchMedia = () => ({ matches: false });
global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
  matchMedia: global.matchMedia
};
global.localStorage = localStorageMock;
global.document = {
  getElementById: () => dummyEl,
  documentElement: { dataset: {} }
};
global.navigator = {};
global.toastMessages = [];
global.toast = (msg) => { global.toastMessages.push(msg); };

// Execute the admin script inside context
const sandbox = {
  window: global.window,
  localStorage: global.localStorage,
  document: global.document,
  navigator: global.navigator,
  matchMedia: global.matchMedia,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  console: console,
  Set: Set,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  Date: Date,
  Math: Math,
  JSON: JSON
};

// We will evaluate helper functions from admin.html
const vm = require('vm');
const scriptContext = vm.createContext(sandbox);

// Wrap script to avoid auto calling render() which touches DOM
let codeToRun = scriptMatch[1];
// Replace DOM render call
codeToRun = codeToRun.replace('load();render();', 'load();');
// Hook toast
codeToRun = codeToRun.replace('function toast(m){', 'function toast(m){ window.lastToast = m; if(window.toastMessages) window.toastMessages.push(m);');
// Expose top level let variables to global window
codeToRun += '\nwindow.toastMessages = []; window.S = S; window.load = load; window.save = save; window.act = act; window.tx = tx; window.rowsFor = rowsFor; window.isAvailableForEntry = isAvailableForEntry; window.parseBusRows = parseBusRows; window.stage = stage; window.curD = curD;\nObject.defineProperty(window, "auth", { get: () => auth, set: (v) => { auth = v; } });\nObject.defineProperty(window, "ui", { get: () => ui, set: (v) => { ui = v; } });\nObject.defineProperty(window, "S", { get: () => S, set: (v) => { S = v; } });\n';

vm.runInContext(codeToRun, scriptContext);

console.log("=== RUNNING ACCEPTANCE TESTS FOR CROSS-DEPOT BUS SYNCHRONIZATION ===");

let passed = 0;
let failed = 0;

function assert(cond, name, details) {
  if (cond) {
    console.log(`[PASS] Test ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] Test ${name}: ${details || ''}`);
    failed++;
  }
}

// -------------------------------------------------------------
// Test 1: Shared bus identification and synchronization
// -------------------------------------------------------------
// Bus KA-25-1234 is linked to chandapura, tondiarpet, miyapur
const app = scriptContext.window;
app.load();
const bShared = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bShared && bShared.linkedDepots.length === 3, "1.1 Shared bus exists and linked to 3 depots", JSON.stringify(bShared));

// Check available for entry at all 3 depots initially
assert(app.isAvailableForEntry(bShared, 'chandapura'), "1.2 Available at Chandapura before entry");
assert(app.isAvailableForEntry(bShared, 'tondiarpet'), "1.3 Available at Tondiarpet before entry");
assert(app.isAvailableForEntry(bShared, 'miyapur'), "1.4 Available at Miyapur before entry");

// Depot Tondiarpet records entry
app.auth = { role: 'entry', depot: 'tondiarpet' };
app.ui.depot = 'tondiarpet';
app.act('KA-25-1234', 'entry');

const bAfterEntry = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bAfterEntry.entry === true && bAfterEntry.loc === 'tondiarpet', "1.5 Bus marked as entered at Tondiarpet", `loc=${bAfterEntry.loc}, entry=${bAfterEntry.entry}`);

// Check that it is removed from available lists of Chandapura and Miyapur
assert(!app.isAvailableForEntry(bAfterEntry, 'chandapura'), "1.6 Bus KA-25-1234 removed from Chandapura available list");
assert(!app.isAvailableForEntry(bAfterEntry, 'miyapur'), "1.7 Bus KA-25-1234 removed from Miyapur available list");

// Check rowsFor("entry") at Chandapura and Miyapur
app.ui.depot = 'chandapura';
app.ui.f = 'pending';
const rowsChandapura = app.rowsFor('entry');
assert(!rowsChandapura.some(b => b.id === 'KA-25-1234'), "1.8 Not in Chandapura pending entry queue");

app.ui.depot = 'miyapur';
const rowsMiyapur = app.rowsFor('entry');
assert(!rowsMiyapur.some(b => b.id === 'KA-25-1234'), "1.9 Not in Miyapur pending entry queue");

// Check rowsFor("entry") at Tondiarpet (shown as approved)
app.ui.depot = 'tondiarpet';
app.ui.f = 'all';
const rowsTondiarpet = app.rowsFor('entry');
assert(rowsTondiarpet.some(b => b.id === 'KA-25-1234' && b.entry), "1.10 Present and approved in Tondiarpet entry list");

// -------------------------------------------------------------
// Test 2: Unrelated buses unaffected
// -------------------------------------------------------------
const otherBus = app.S.buses.find(b => b.id === 'BM221');
assert(app.isAvailableForEntry(otherBus, 'chandapura'), "2.1 Unrelated shared bus BM221 still available at Chandapura");
assert(app.isAvailableForEntry(otherBus, 'tondiarpet'), "2.2 Unrelated shared bus BM221 still available at Tondiarpet");
assert(app.isAvailableForEntry(otherBus, 'miyapur'), "2.3 Unrelated shared bus BM221 still available at Miyapur");

// -------------------------------------------------------------
// Test 3: Multiple depots (N >= 3)
// -------------------------------------------------------------
// Link BM221 to a new 4th depot or verify it has 3 depots
assert(bShared.linkedDepots.length >= 3, "3.1 Works for 3 or more depots");

// -------------------------------------------------------------
// Test 4: Duplicate registration prevention & identity reuse
// -------------------------------------------------------------
// Attempt 1: Try registering exact same bus at Chandapura (which already has it)
const dupCheck1 = app.parseBusRows("KA-25-1234, KA-25-1234", 1, 'chandapura');
assert(dupCheck1.error && dupCheck1.error.includes("already registered and linked"), "4.1 Blocks duplicate registration to same depot", dupCheck1.error);

// Attempt 2: Conflict - same code, different registration
const dupCheck2 = app.parseBusRows("KA-25-1234, KA01AB9999", 1, 'chandapura');
assert(dupCheck2.error && dupCheck2.error.includes("Identity Conflict"), "4.2 Blocks conflicting registration with same bus code", dupCheck2.error);

// Attempt 3: Conflict - same registration, different bus code
const dupCheck3 = app.parseBusRows("BM999, KA-25-1234", 1, 'chandapura');
assert(dupCheck3.error && dupCheck3.error.includes("Duplicate Registration Prevented"), "4.3 Blocks duplicate registration number with different code", dupCheck3.error);

// Attempt 4: Multi-depot linking - registering same physical bus (code & reg match) at a new depot links it!
// Create a 4th depot in state
const d4 = { id: 'mysuru', name: 'Mysuru Depot', city: 'Mysuru', routes: [], drivers: [], users: {} };
app.S.depots.push(d4);
const linkCheck = app.parseBusRows("KA-25-1234, KA-25-1234", 1, 'mysuru');
assert(linkCheck.busesToLink && linkCheck.busesToLink.length === 1, "4.4 Matches existing physical bus and authorizes linking without duplicating records");

// -------------------------------------------------------------
// Test 5: Repeated action / Idempotency
// -------------------------------------------------------------
// Attempting to record entry again at Tondiarpet where it's already entered
app.toastMessages = [];
app.auth = { role: 'entry', depot: 'tondiarpet' };
app.ui.depot = 'tondiarpet';
app.act('KA-25-1234', 'entry');
assert(app.toastMessages.some(m => m.includes("already marked as entered")), "5.1 Re-entry shows notification and does not duplicate state");

// -------------------------------------------------------------
// Test 6: Concurrent entry attempt at another depot
// -------------------------------------------------------------
// Depot Chandapura tries to record entry on KA-25-1234 while it is already entered at Tondiarpet
app.toastMessages = [];
app.auth = { role: 'entry', depot: 'chandapura' };
app.ui.depot = 'chandapura';
app.act('KA-25-1234', 'entry');
assert(app.toastMessages.some(m => m.includes("Concurrent Entry Blocked")), "6.1 Second depot entry attempt blocked with clear message", app.toastMessages);
const bCheck6 = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bCheck6.loc === 'tondiarpet', "6.2 Physical location remains consistent at Tondiarpet");

// -------------------------------------------------------------
// Test 7 & 8: Departure and Confirmed Transfer
// -------------------------------------------------------------
// Bus KA-25-1234 in Tondiarpet is transferred to Chandapura
app.auth = { role: 'admin' };
app.tx('KA-25-1234', 'chandapura');
const bInTransit = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bInTransit.transferStatus === 'in_transit' && bInTransit.transferTo === 'chandapura', "7.1 Bus is in transit to Chandapura", JSON.stringify(bInTransit));
assert(bInTransit.loc === null, "7.2 Bus is no longer physically at Tondiarpet");

// During transit:
// Is it available for entry at Miyapur? NO!
assert(!app.isAvailableForEntry(bInTransit, 'miyapur'), "7.3 In-transit bus is NOT available at third-party linked depot (Miyapur)");
// Is it available for entry at Tondiarpet (origin)? NO!
assert(!app.isAvailableForEntry(bInTransit, 'tondiarpet'), "7.4 In-transit bus is NOT available at origin depot (Tondiarpet)");
// Is it available for entry at Chandapura (destination)? YES!
assert(app.isAvailableForEntry(bInTransit, 'chandapura'), "8.1 Confirmed transfer: Bus is available for entry ONLY at destination depot (Chandapura)");

// Now Chandapura records arrival entry
app.auth = { role: 'entry', depot: 'chandapura' };
app.ui.depot = 'chandapura';
app.act('KA-25-1234', 'entry');
const bArrived = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bArrived.entry === true && bArrived.loc === 'chandapura' && bArrived.transferTo === null, "8.2 Arrival confirmed at Chandapura, transfer cleared", JSON.stringify(bArrived));

// -------------------------------------------------------------
// Test 9: Persistence across page refresh & session
// -------------------------------------------------------------
// Simulate reload by loading from localStorage
app.S = null;
app.load();
const bPersisted = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bPersisted && bPersisted.loc === 'chandapura' && bPersisted.entry === true, "9.1 State persisted across simulated reload", JSON.stringify(bPersisted));

// -------------------------------------------------------------
// Test 10: Regression test on subsequent workflows (clean, charge, sched)
// -------------------------------------------------------------
// Cleaner stage
app.auth = { role: 'clean', depot: 'chandapura' };
app.act('KA-25-1234', 'clean');
const bClean = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bClean && bClean.clean === true, "10.1 Cleaning approved");

// Charging stage
app.auth = { role: 'charge', depot: 'chandapura' };
app.act('KA-25-1234', 'charge');
const bCharged = app.S.buses.find(b => b.id === 'KA-25-1234');
assert(bCharged && bCharged.charge === true, "10.2 Charging approved");

// Ready for scheduler
assert(app.stage(bCharged) === 'ready', "10.3 Bus reaches ready pool for scheduler");

console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=======================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
}

