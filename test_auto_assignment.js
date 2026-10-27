/**
 * Comprehensive Test Suite for Automatic Bus and Driver Assignment
 * Covers all 14 Edge Cases and Acceptance Scenarios defined in Section 8 of Project Requirements:
 *
 * 1. A route has multiple available buses and drivers.
 * 2. A route has only one suitable bus and one eligible driver.
 * 3. No suitable bus is available.
 * 4. No eligible driver is available.
 * 5. The selected bus is already assigned to an overlapping trip.
 * 6. The selected driver is already assigned to an overlapping trip.
 * 7. A bus is associated with a different depot but is otherwise operationally eligible.
 * 8. A bus is operationally unavailable (maintenance, defect hold).
 * 9. The user changes the route after a recommendation has been generated.
 * 10. Two users attempt to assign the same bus simultaneously (concurrency conflict).
 * 11. The assignment fails during database persistence (atomic consistency).
 * 12. The selected route does not exist or becomes unavailable.
 * 13. A route is selected when no routes are available.
 * 14. The application is refreshed after an assignment is saved (persistence verification).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { store = {}; },
        _dump: () => store
    };
})();

// Create clean sandbox
const sandbox = {
    console: console,
    Set: Set,
    Map: Map,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    Date: Date,
    Math: Math,
    JSON: JSON,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.localStorage = localStorageMock;

// Load app_data.js
const appDataCode = fs.readFileSync(path.join(__dirname, 'src', 'data', 'app_data.js'), 'utf-8');
vm.runInNewContext(appDataCode, sandbox);

// Load database.js
const databaseCode = fs.readFileSync(path.join(__dirname, 'src', 'js', 'database.js'), 'utf-8');
vm.runInNewContext(databaseCode, sandbox);

const FleetDB = sandbox.FleetDB;
const FLEET = sandbox.FLEET;
const SCHEDULES = sandbox.SCHEDULES;
const ROUTES = sandbox.ROUTES;

console.log("=== RUNNING AUTOMATIC BUS & DRIVER ASSIGNMENT TEST SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition, testName, details) {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testName}: ${details || ''}`);
        failed++;
    }
}

// Reset clean database state helper
function resetEnvironment() {
    localStorageMock.clear();
    FleetDB.initAll();
}

// -----------------------------------------------------------------------------
// Test Scenario 1: Multiple available buses and drivers
// Priority strategy: Category preservation (C > B > A), lowest positive buffer, and default driver affinity.
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    // Prepare ready pool with Cat A, Cat B, Cat C buses
    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-C1'] = { busId: 'BUS-C1', regNo: 'KA-51-C1', cat: 'C', actualRange: 90, driver: 'Suresh Kumar', enrolledAt: new Date().toISOString() };
    schedData['BUS-B1'] = { busId: 'BUS-B1', regNo: 'KA-51-B1', cat: 'B', actualRange: 110, driver: 'Venkatesh R', enrolledAt: new Date().toISOString() };
    schedData['BUS-A1'] = { busId: 'BUS-A1', regNo: 'KA-51-A1', cat: 'A', actualRange: 125, driver: 'Ramesh Gowda', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    // Simple route allowing A, B, C; req: 80km
    const testSchedule = {
        id: 'SCH-TEST-MULTI',
        route: 'SW-356',
        departure: '08:00',
        arrival: '16:00',
        singleChargeReq: 80,
        allowedCats: ['A', 'B', 'C'],
        driverReq: 'Standard'
    };

    const rec = FleetDB.Scheduler.recommendAssignment(testSchedule.id, {
        schedules: [testSchedule],
        fleet: FLEET
    });

    assert(rec.success === true, 'Scenario 1.1: Automatic recommendation succeeds for multi-resource route');
    assert(rec.bus && rec.bus.busId === 'BUS-C1', 'Scenario 1.2: Category C bus prioritized to preserve A and B buses', `Got ${rec.bus ? rec.bus.busId : 'none'}`);
    assert(rec.driver === 'Suresh Kumar', 'Scenario 1.3: Default driver affinity preserved for recommended bus', `Got ${rec.driver}`);
    assert(rec.bufferKm === 10, 'Scenario 1.4: Accurate safety buffer calculated (+10 km)', `Got ${rec.bufferKm}`);
})();

// -----------------------------------------------------------------------------
// Test Scenario 2: Exactly one suitable bus and one eligible driver
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    // One bus fits (Cat A, 120km), another bus is too low (Cat B, 70km)
    schedData['BUS-FIT'] = { busId: 'BUS-FIT', regNo: 'KA-51-FIT', cat: 'A', actualRange: 122, driver: 'Ramesh Gowda', enrolledAt: new Date().toISOString() };
    schedData['BUS-LOW'] = { busId: 'BUS-LOW', regNo: 'KA-51-LOW', cat: 'A', actualRange: 90, driver: 'Girish Gowda', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const testSchedule = {
        id: 'SCH-TEST-ONE',
        route: 'SW-328',
        departure: '06:00',
        arrival: '14:00',
        singleChargeReq: 115,
        allowedCats: ['A'],
        driverReq: 'Senior'
    };

    const rec = FleetDB.Scheduler.recommendAssignment(testSchedule.id, {
        schedules: [testSchedule],
        fleet: FLEET
    });

    assert(rec.success === true, 'Scenario 2.1: Recommendation succeeds with exactly one suitable resource set');
    assert(rec.bus.busId === 'BUS-FIT', 'Scenario 2.2: Correct unique suitable bus selected', `Got ${rec.bus.busId}`);
    assert(rec.driver === 'Ramesh Gowda', 'Scenario 2.3: Correct eligible Senior driver identified', `Got ${rec.driver}`);
})();

// -----------------------------------------------------------------------------
// Test Scenario 3: No suitable bus available (due to range or category)
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    // Only Cat C bus available with 80km
    schedData['BUS-ONLY-C'] = { busId: 'BUS-ONLY-C', regNo: 'KA-51-C', cat: 'C', actualRange: 80, driver: 'Ramesh Gowda', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    // Route requires Cat A or B with 110km
    const testSchedule = {
        id: 'SCH-TEST-NOBUS',
        route: 'SW-600',
        departure: '07:00',
        arrival: '15:00',
        singleChargeReq: 110,
        allowedCats: ['A', 'B'],
        driverReq: 'Standard'
    };

    const rec = FleetDB.Scheduler.recommendAssignment(testSchedule.id, {
        schedules: [testSchedule],
        fleet: FLEET
    });

    assert(rec.success === false, 'Scenario 3.1: Recommendation fails safely when no suitable bus exists');
    assert(rec.errorType === 'NO_BUS', 'Scenario 3.2: Error type is explicitly NO_BUS', `Got ${rec.errorType}`);
    assert(rec.reason && rec.reason.includes('No suitable and available bus found'), 'Scenario 3.3: Informative reasoning provided');
})();

// -----------------------------------------------------------------------------
// Test Scenario 4: No eligible driver available (Senior qualification required)
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-OK'] = { busId: 'BUS-OK', regNo: 'KA-51-OK', cat: 'A', actualRange: 130, driver: 'StandardDriverOnly', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const testSchedule = {
        id: 'SCH-TEST-NODRIVER',
        route: 'SW-360',
        departure: '07:00',
        arrival: '15:00',
        singleChargeReq: 50,
        allowedCats: ['A'],
        driverReq: 'Senior'
    };

    const rec = FleetDB.Scheduler.recommendAssignment(testSchedule.id, {
        schedules: [testSchedule],
        fleet: [{ driver: 'StandardDriverOnly' }],
        seniorDrivers: new Set(['Ramesh Gowda']) // only Ramesh is senior, but not in driver pool
    });

    assert(rec.success === false, 'Scenario 4.1: Recommendation fails safely when no eligible driver exists');
    assert(rec.errorType === 'NO_DRIVER', 'Scenario 4.2: Error type is explicitly NO_DRIVER', `Got ${rec.errorType}`);
    assert(rec.reason && rec.reason.includes('No eligible driver available'), 'Scenario 4.3: Informative error message returned');
})();

// -----------------------------------------------------------------------------
// Test Scenario 5: Selected bus is already assigned to an overlapping trip
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-SHARED'] = {
        busId: 'BUS-SHARED',
        regNo: 'KA-51-SH',
        cat: 'A',
        actualRange: 130,
        driver: 'Ramesh Gowda',
        scheduleAssigned: 'SCH-EXISTING',
        assignedDriver: 'Ramesh Gowda',
        assignedAt: new Date().toISOString()
    };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const existingSch = { id: 'SCH-EXISTING', departure: '08:00', arrival: '14:00' };
    const overlappingSch = { id: 'SCH-NEW-OVERLAP', departure: '10:00', arrival: '18:00', singleChargeReq: 60, allowedCats: ['A'], driverReq: 'Standard' };

    const rec = FleetDB.Scheduler.recommendAssignment(overlappingSch.id, {
        schedules: [existingSch, overlappingSch],
        fleet: FLEET
    });

    assert(rec.success === false && rec.errorType === 'NO_BUS', 'Scenario 5.1: Bus on overlapping trip is excluded from recommendation');

    // Attempting direct assign throws concurrency/schedule conflict error
    let threw = false;
    try {
        FleetDB.Scheduler.assignBus('BUS-SHARED', overlappingSch.id, 'Suresh Kumar', {
            schedules: [existingSch, overlappingSch]
        });
    } catch (e) {
        threw = true;
        assert(e.message.includes('Concurrency Conflict'), 'Scenario 5.2: Direct assignment to overlapping bus throws Concurrency Conflict', e.message);
    }
    assert(threw, 'Scenario 5.3: Assignment blocked for overlapping bus');
})();

// -----------------------------------------------------------------------------
// Test Scenario 6: Selected driver is already assigned to an overlapping trip
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-1'] = {
        busId: 'BUS-1',
        regNo: 'KA-51-01',
        cat: 'A',
        actualRange: 130,
        scheduleAssigned: 'TRIP-1',
        assignedDriver: 'Ramesh Gowda',
        assignedAt: new Date().toISOString()
    };
    schedData['BUS-2'] = {
        busId: 'BUS-2',
        regNo: 'KA-51-02',
        cat: 'A',
        actualRange: 130,
        scheduleAssigned: null,
        assignedDriver: null
    };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const trip1 = { id: 'TRIP-1', departure: '08:00', arrival: '16:00' };
    const trip2 = { id: 'TRIP-2', departure: '12:00', arrival: '20:00', singleChargeReq: 60, allowedCats: ['A'], driverReq: 'Senior' };

    const rec = FleetDB.Scheduler.recommendAssignment(trip2.id, {
        schedules: [trip1, trip2],
        fleet: [{ driver: 'Ramesh Gowda' }, { driver: 'Suresh Kumar' }],
        seniorDrivers: new Set(['Ramesh Gowda', 'Suresh Kumar'])
    });

    assert(rec.success === true, 'Scenario 6.1: Assignment engine finds non-conflicting alternative driver');
    assert(rec.driver === 'Suresh Kumar', 'Scenario 6.2: Overlapping driver Ramesh Gowda bypassed; Suresh Kumar selected', `Got ${rec.driver}`);

    // Direct attempt to assign Ramesh Gowda to trip2 should fail
    let threw = false;
    try {
        FleetDB.Scheduler.assignBus('BUS-2', trip2.id, 'Ramesh Gowda', {
            schedules: [trip1, trip2]
        });
    } catch (e) {
        threw = true;
        assert(e.message.includes('Concurrency Conflict: Driver Ramesh Gowda is already committed'), 'Scenario 6.3: Atomic guard rejects overlapping driver', e.message);
    }
    assert(threw, 'Scenario 6.4: Assignment of conflicting driver rejected');
})();

// -----------------------------------------------------------------------------
// Test Scenario 7: Bus associated with a different depot is eligible
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    // Multi-depot state with bus BM-D18 whose home depot is 'Depot 18', but is entered & linked at Chandapura
    const multiDepotState = {
        buses: [{
            id: 'BM-D18',
            reg: 'KA-51-D18',
            clean: true, charge: true, // This cross-depot bus has completed both readiness checks.
            cat: 'B',
            actualRange: 110,
            depot: 'Depot 18',
            linkedDepots: ['Depot 18', 'Depot 44 (Chandapura)'],
            loc: 'Depot 44 (Chandapura)',
            entry: {
                'Depot 44 (Chandapura)': { enteredAt: new Date().toISOString(), approved: true }
            },
            maintenance: false,
            driver: 'Venkatesh R'
        }]
    };
    localStorageMock.setItem('sfos_multi_v2', JSON.stringify(multiDepotState));

    const testSchedule = {
        id: 'SCH-D44-ROUTE',
        route: 'SW-600',
        departure: '08:00',
        arrival: '16:00',
        singleChargeReq: 85,
        allowedCats: ['B'],
        driverReq: 'Standard'
    };

    const pool = FleetDB.Scheduler.getReadyPool('Depot 44 (Chandapura)');
    const foundCrossDepotBus = pool.some(b => b.busId === 'BM-D18');
    assert(foundCrossDepotBus, 'Scenario 7.1: Bus from Depot 18 present in Chandapura ready pool (not excluded by home depot)');

    const rec = FleetDB.Scheduler.recommendAssignment(testSchedule.id, {
        depotId: 'Depot 44 (Chandapura)',
        schedules: [testSchedule],
        fleet: multiDepotState.buses
    });

    assert(rec.success === true, 'Scenario 7.2: Recommendation succeeds with cross-depot bus');
    assert(rec.bus.busId === 'BM-D18', 'Scenario 7.3: Cross-depot bus successfully assigned to route', `Got ${rec.bus ? rec.bus.busId : 'none'}`);
})();

// -----------------------------------------------------------------------------
// Test Scenario 8: Bus is operationally unavailable (maintenance or defect hold)
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-MAINT'] = { busId: 'BUS-MAINT', regNo: 'KA-51-M1', cat: 'A', actualRange: 130, driver: 'Ramesh Gowda', enrolledAt: new Date().toISOString() };
    schedData['BUS-DEFECT'] = { busId: 'BUS-DEFECT', regNo: 'KA-51-D1', cat: 'A', actualRange: 130, driver: 'Suresh Kumar', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const customFleet = [
        { id: 'BUS-MAINT', maintenance: true, hasDefectHold: false },
        { id: 'BUS-DEFECT', maintenance: false, hasDefectHold: true }
    ];

    const testSchedule = { id: 'SCH-OP-TEST', route: 'SW-356', departure: '07:00', arrival: '15:00', singleChargeReq: 50, allowedCats: ['A'] };

    const rec = FleetDB.Scheduler.recommendAssignment(testSchedule.id, {
        schedules: [testSchedule],
        fleet: customFleet
    });

    assert(rec.success === false && rec.errorType === 'NO_BUS', 'Scenario 8.1: Operationally unavailable buses excluded from ready pool');

    // Test assignBus rejecting operationally unavailable bus
    let threw = false;
    try {
        FleetDB.Scheduler.assignBus('BUS-MAINT', testSchedule.id, 'Ramesh Gowda', {
            schedules: [testSchedule],
            fleet: customFleet
        });
    } catch (e) {
        threw = true;
        assert(e.message.includes('Operational Error'), 'Scenario 8.2: assignBus rejects maintenance/defect hold bus', e.message);
    }
    assert(threw, 'Scenario 8.3: Direct assignment of maintenance bus rejected');
})();

// -----------------------------------------------------------------------------
// Test Scenario 9: User changes route after recommendation generated
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-CAT-C'] = { busId: 'BUS-CAT-C', regNo: 'KA-51-C', cat: 'C', actualRange: 80, driver: 'Girish Gowda', enrolledAt: new Date().toISOString() };
    schedData['BUS-CAT-A'] = { busId: 'BUS-CAT-A', regNo: 'KA-51-A', cat: 'A', actualRange: 125, driver: 'Ramesh Gowda', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    // Route 1 is Simple (Cat C fits)
    const route1 = { id: 'SCH-R1', route: 'SW-356', departure: '06:00', arrival: '14:00', singleChargeReq: 70, allowedCats: ['A', 'B', 'C'], driverReq: 'Standard' };
    // Route 2 is Complex (Cat A required, Senior driver)
    const route2 = { id: 'SCH-R2', route: 'SW-360', departure: '06:00', arrival: '14:00', singleChargeReq: 110, allowedCats: ['A'], driverReq: 'Senior' };

    const rec1 = FleetDB.Scheduler.recommendAssignment(route1.id, { schedules: [route1, route2], fleet: FLEET });
    assert(rec1.bus.busId === 'BUS-CAT-C', 'Scenario 9.1: First route selection assigns Cat C bus');

    // Route switched to Route 2
    const rec2 = FleetDB.Scheduler.recommendAssignment(route2.id, { schedules: [route1, route2], fleet: FLEET });
    assert(rec2.bus.busId === 'BUS-CAT-A', 'Scenario 9.2: Route switch recalculates bus, does not preserve incompatible Cat C bus', `Got ${rec2.bus.busId}`);
    assert(rec2.driver === 'Ramesh Gowda', 'Scenario 9.3: Route switch recalculates driver, requires Senior driver', `Got ${rec2.driver}`);
})();

// -----------------------------------------------------------------------------
// Test Scenario 10: Two users attempt to assign the same bus simultaneously
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-CONCUR'] = { busId: 'BUS-CONCUR', regNo: 'KA-51-CC', cat: 'B', actualRange: 100, driver: 'Suresh Kumar', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const schA = { id: 'SCH-USER-A', departure: '08:00', arrival: '16:00', singleChargeReq: 70, allowedCats: ['B'], driverReq: 'Standard' };
    const schB = { id: 'SCH-USER-B', departure: '09:00', arrival: '17:00', singleChargeReq: 70, allowedCats: ['B'], driverReq: 'Standard' };

    // User A commits first
    const assignA = FleetDB.Scheduler.assignBus('BUS-CONCUR', schA.id, 'Suresh Kumar', { schedules: [schA, schB] });
    assert(assignA && assignA.scheduleAssigned === schA.id, 'Scenario 10.1: User A successfully commits assignment');

    // User B attempts to commit same bus simultaneously
    let threw = false;
    try {
        FleetDB.Scheduler.assignBus('BUS-CONCUR', schB.id, 'Someshwara Reddy', { schedules: [schA, schB] });
    } catch (e) {
        threw = true;
        assert(e.message.includes('Concurrency Conflict'), 'Scenario 10.2: User B receives Concurrency Conflict error', e.message);
    }
    assert(threw, 'Scenario 10.3: Simultaneous duplicate assignment safely rejected');
})();

// -----------------------------------------------------------------------------
// Test Scenario 11: Atomic consistency and persistence failure safety
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-ATOMIC'] = { busId: 'BUS-ATOMIC', regNo: 'KA-51-AT', cat: 'B', actualRange: 100, driver: 'Suresh Kumar', scheduleAssigned: null, enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const schInvalid = { id: 'SCH-BAD-RANGE', departure: '08:00', arrival: '16:00', singleChargeReq: 150, allowedCats: ['B'] };

    let threw = false;
    try {
        // Range check will fail inside assignBus
        FleetDB.Scheduler.assignBus('BUS-ATOMIC', schInvalid.id, 'Suresh Kumar', { schedules: [schInvalid] });
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Scenario 11.1: Failed assignment throws validation error');

    // Check database state remains consistent (not corrupted)
    const reloaded = FleetDB.Scheduler.getAll();
    const bus = reloaded.find(b => b.busId === 'BUS-ATOMIC');
    assert(bus && !bus.scheduleAssigned, 'Scenario 11.2: Record remains unassigned after failure (no partial state)');
})();

// -----------------------------------------------------------------------------
// Test Scenario 12: Selected route does not exist or becomes unavailable
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const rec = FleetDB.Scheduler.recommendAssignment('SCH-NON-EXISTENT', { schedules: [] });
    assert(rec.success === false, 'Scenario 12.1: Non-existent route handled gracefully');
    assert(rec.errorType === 'INVALID_SCHEDULE', 'Scenario 12.2: errorType is INVALID_SCHEDULE', rec.errorType);
})();

// -----------------------------------------------------------------------------
// Test Scenario 13: Empty route selection or empty routes list
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const rec1 = FleetDB.Scheduler.recommendAssignment('', { schedules: [] });
    assert(rec1.success === false && rec1.errorType === 'INVALID_SCHEDULE', 'Scenario 13.1: Empty route ID string handled gracefully');

    const rec2 = FleetDB.Scheduler.recommendAssignment(null, { schedules: [] });
    assert(rec2.success === false && rec2.errorType === 'INVALID_SCHEDULE', 'Scenario 13.2: Null route ID handled gracefully');
})();

// -----------------------------------------------------------------------------
// Test Scenario 14: Refresh application after assignment (persistence verification)
// -----------------------------------------------------------------------------
(() => {
    resetEnvironment();

    const schedData = FleetDB.Scheduler.init();
    schedData['BUS-PERSIST'] = { busId: 'BUS-PERSIST', regNo: 'KA-51-PS', cat: 'B', actualRange: 100, driver: 'Suresh Kumar', enrolledAt: new Date().toISOString() };
    localStorageMock.setItem('smart_fleet_db_scheduler', JSON.stringify(schedData));

    const testSch = { id: 'SCH-PERSIST', departure: '08:00', arrival: '16:00', singleChargeReq: 70, allowedCats: ['B'], driverReq: 'Standard' };

    FleetDB.Scheduler.assignBus('BUS-PERSIST', testSch.id, 'Suresh Kumar', { schedules: [testSch] });

    // Simulate page reload by creating a new VM context and reading localStorage
    const reloadSandbox = {
        console: console, Set: Set, Map: Map, Number: Number, String: String,
        Array: Array, Object: Object, Date: Date, Math: Math, JSON: JSON
    };
    reloadSandbox.window = reloadSandbox;
    reloadSandbox.global = reloadSandbox;
    reloadSandbox.localStorage = localStorageMock;

    vm.runInNewContext(databaseCode, reloadSandbox);
    const reloadedFleetDB = reloadSandbox.FleetDB;

    const assignments = reloadedFleetDB.Scheduler.getAssignments();
    const persisted = assignments.find(b => b.busId === 'BUS-PERSIST');

    assert(persisted !== undefined, 'Scenario 14.1: Assignment persisted across application refresh');
    assert(persisted && persisted.scheduleAssigned === 'SCH-PERSIST', 'Scenario 14.2: Persisted schedule ID accurately reloaded');
    assert(persisted && persisted.assignedDriver === 'Suresh Kumar', 'Scenario 14.3: Persisted driver accurately reloaded');

    // Test unassigning to verify complete assignment lifecycle
    const unassigned = reloadedFleetDB.Scheduler.unassignBus('BUS-PERSIST');
    assert(unassigned === true, 'Scenario 14.4: Unassign action succeeds');
    assert(reloadedFleetDB.Scheduler.getAssignments().length === 0, 'Scenario 14.5: Bus cleanly returned to ready pool');
})();

console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=======================================================");

if (failed === 0) {
    console.log("ALL AUTOMATIC ASSIGNMENT ACCEPTANCE TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
} else {
    console.error("SOME TESTS FAILED!\n");
    process.exit(1);
}
