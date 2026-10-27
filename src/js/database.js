/**
 * Smart Fleet OS - Multi-Database State & Flow Controller
 * Depot 44 (Chandapura), Bengaluru
 *
 * Implements 4 distinct databases for the 4 workflow roles:
 *  1. EntryRecorderDB - Depot intake database (owns the full 122-bus fleet)
 *  2. CleanerDB        - Cleaning bay operations database
 *  3. ChargingDB       - Charging infrastructure operations database
 *  4. SchedulerDB      - Route assignment & dispatch operations database
 *
 * Flow Rule:
 *  Entry Recorder: approved -->> Cleaner AND Charging Incharge: approved from BOTH -->> Scheduler
 */

(function (globalContext) {
    'use strict';

    const rootScope = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalContext || {});

    // In-memory fallback if localStorage is unavailable
    const memoryStore = {};
    function getStorage() {
        try {
            if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
            if (rootScope && rootScope.localStorage) return rootScope.localStorage;
        } catch (e) {}
        return {
            getItem: (k) => (Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k] : null),
            setItem: (k, v) => { memoryStore[k] = String(v); },
            removeItem: (k) => { delete memoryStore[k]; },
            clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); }
        };
    }

    // Storage Keys for the 4 separate databases
    const DB_KEYS = {
        ENTRY_RECORDER: 'smart_fleet_db_entry_recorder',
        CLEANER: 'smart_fleet_db_cleaner',
        CHARGING: 'smart_fleet_db_charging',
        SCHEDULER: 'smart_fleet_db_scheduler'
    };

    // Helper: Safe JSON load/save
    function loadDB(key, fallback = {}) {
        try {
            const raw = getStorage().getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.error(`Error loading database [${key}]:`, e);
            return fallback;
        }
    }

    function saveDB(key, data) {
        try {
            getStorage().setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Error saving database [${key}]:`, e);
            throw new Error("Could not save on this device. Check browser storage and try again.");
        }
    }

    function dispatchFleetEvent(stage, details = {}) {
        try {
            if (rootScope && typeof rootScope.dispatchEvent === 'function') {
                if (typeof CustomEvent !== 'undefined') {
                    rootScope.dispatchEvent(new CustomEvent('fleet-db-updated', { detail: { stage, ...details } }));
                } else {
                    rootScope.dispatchEvent({ type: 'fleet-db-updated', detail: { stage, ...details } });
                }
            }
        } catch (e) {}
    }

    // Helper: get base fleet data
    function getBaseFleet() {
        if (typeof FLEET !== 'undefined' && Array.isArray(FLEET) && FLEET.length > 0) {
            return FLEET;
        }
        if (rootScope.FLEET && Array.isArray(rootScope.FLEET)) {
            return rootScope.FLEET;
        }
        return [];
    }

    const MULTI_DEPOT_KEY = 'sfos_multi_v2';
    function getMultiDepotState() {
        try {
            const raw = getStorage().getItem(MULTI_DEPOT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }
    function saveMultiDepotState(state) {
        try {
            getStorage().setItem(MULTI_DEPOT_KEY, JSON.stringify(state));
        } catch (e) {}
    }

    // Mirror workflow transitions into Admin's physical-bus record. The role
    // databases remain authoritative for their own approval and assignment data.
    function syncMultiDepotBus(busId, changes, message) {
        try {
            const multi = getMultiDepotState();
            if (!multi || !Array.isArray(multi.buses)) return false;
            const stageBus = (typeof changes.regNo === 'string' ? changes.regNo : null);
            const bus = multi.buses.find(item => (item.id || item.busId) === busId ||
                (stageBus && item.reg && item.reg.toLowerCase() === stageBus.toLowerCase()));
            if (!bus) return false;
            Object.assign(bus, changes);
            if (message && Array.isArray(multi.log)) {
                const depotId = bus.loc || bus.entryDepot || bus.home;
                multi.log.unshift({
                    t: new Date().toLocaleTimeString('en-GB'),
                    m: message,
                    d: depotId ? [depotId] : []
                });
                multi.log = multi.log.slice(0, 300);
            }
            saveMultiDepotState(multi);
            return true;
        } catch (e) {
            return false;
        }
    }

    const ISSUE_KEY = 'smart_fleet_issues';
    const IssuesDB = {
        getAll() { return loadDB(ISSUE_KEY, []); },
        isHeld(busId) { return this.getAll().some(i => i.busId === busId && !i.resolvedAt); },
        report(busId, depotId, role, reason, notes, operator) {
            if (!busId || !depotId || !reason) throw new Error('Choose a bus and problem.');
            const rows = this.getAll();
            if (rows.some(i => i.busId === busId && i.depotId === depotId && !i.resolvedAt)) throw new Error('A problem is already open for this bus.');
            const record = {id: 'issue-' + Date.now() + '-' + Math.random().toString(36).slice(2), busId, depotId, role, reason, notes, operator, createdAt: new Date().toISOString()};
            rows.push(record);
            getStorage().setItem(ISSUE_KEY, JSON.stringify(rows));
            dispatchFleetEvent('issue', {busId, depotId});
            return record;
        },
        resolve(id, depotId, resolution, operator) {
            const rows = this.getAll(), item = rows.find(i => i.id === id && i.depotId === depotId);
            if (!item || item.resolvedAt || !String(resolution).trim()) throw new Error('Review the current problem and enter a resolution.');
            item.resolvedAt = new Date().toISOString(); item.resolution = resolution; item.resolvedBy = operator;
            getStorage().setItem(ISSUE_KEY, JSON.stringify(rows));
            dispatchFleetEvent('issue-resolved', {busId:item.busId, depotId});
        }
    };

    // =========================================================================
    // 1. Entry Recorder Database
    // =========================================================================
    const EntryRecorderDB = {
        name: 'EntryRecorderDatabase',
        table: 'entry_recorder_buses',

        init() {
            let data = loadDB(DB_KEYS.ENTRY_RECORDER, null);
            if (!data) {
                const baseFleet = getBaseFleet();
                data = {};
                baseFleet.forEach(bus => {
                    const id = bus.id || bus.busId;
                    data[id] = {
                        busId: id,
                        regNo: bus.regNo || bus.reg || 'N/A',
                        cat: bus.cat || 'B',
                        actualRange: bus.actualRange || 85.0,
                        driver: bus.driver || null,
                        entryApproved: false,
                        approvedAt: null,
                        operator: null
                    };
                });
                saveDB(DB_KEYS.ENTRY_RECORDER, data);
            }
            return data;
        },

        getAll() {
            const data = this.init();
            return Object.values(data);
        },

        // Buses waiting for entry approval (unapproved) - filtered by cross-depot state
        getPending(depotId = 'chandapura') {
            const multi = getMultiDepotState();
            const centralBuses = multi && Array.isArray(multi.buses) ? multi.buses : [];
            const availableAtDepot = bus => {
                const linked = Array.isArray(bus.linkedDepots) && bus.linkedDepots.length
                    ? bus.linkedDepots : [bus.home || bus.loc].filter(Boolean);
                return linked.includes(depotId) && !bus.maintenance && !bus.entry &&
                    !(bus.transferTo && bus.transferTo !== depotId);
            };
            const rows = this.getAll().filter(record => {
                if (record.entryApproved) return false;
                const central = centralBuses.find(bus => bus.id === record.busId ||
                    (bus.reg && record.regNo && bus.reg.toLowerCase() === record.regNo.toLowerCase()));
                const base = getBaseFleet().find(b => (b.id || b.busId) === record.busId);
                return central ? availableAtDepot(central) : depotId === 'chandapura' && !base?.maintenance && !base?.hasDefectHold;
            });
            const known = new Set(rows.map(record => record.busId));
            centralBuses.forEach(bus => {
                const id = bus.id || bus.busId;
                if (!id || known.has(id) || !availableAtDepot(bus)) return;
                const record = this.init()[id];
                if (record && record.entryApproved) return;
                rows.push(record || {
                    busId: id, regNo: bus.reg || bus.regNo || 'N/A', cat: bus.cat || 'B',
                    actualRange: Number(bus.actualRange || 90), entryApproved: false, depotId
                });
            });
            return rows;
        },

        // Approve entry at the authenticated depot and forward to the next role databases.
        approveBus(busId, operator = 'Entry Recorder', depotId = 'chandapura') {
            if (IssuesDB.isHeld(busId)) throw new Error('Bus has an unresolved reported problem');
            if (!this.getPending(depotId).some(b => b.busId === busId)) throw new Error('This bus is no longer waiting for entry');
            const data = this.init();
            const multi = getMultiDepotState();
            const centralBus = multi && Array.isArray(multi.buses)
                ? multi.buses.find(bus => bus.id === busId || bus.busId === busId ||
                    (bus.reg && data[busId]?.regNo && bus.reg.toLowerCase() === data[busId].regNo.toLowerCase()))
                : null;
            if (!data[busId] && centralBus) {
                data[busId] = {
                    busId, regNo: centralBus.reg || centralBus.regNo || 'N/A', cat: centralBus.cat || 'B',
                    actualRange: Number(centralBus.actualRange || 90), driver: centralBus.driver || null,
                    entryApproved: false, approvedAt: null, operator: null
                };
            }
            if (!data[busId]) throw new Error(`Bus ${busId} not found in Entry Recorder Database`);
            if (centralBus) {
                const linked = Array.isArray(centralBus.linkedDepots) && centralBus.linkedDepots.length
                    ? centralBus.linkedDepots : [centralBus.home || centralBus.loc].filter(Boolean);
                if (!linked.includes(depotId)) throw new Error(`Bus ${busId} is not linked to ${depotId}`);
                if (centralBus.entry && centralBus.loc && centralBus.loc !== depotId) {
                    throw new Error(`Concurrent Entry Conflict: Bus ${busId} is already at depot "${centralBus.loc}".`);
                }
                if (centralBus.transferTo && centralBus.transferTo !== depotId) {
                    throw new Error(`Transit Restriction: Bus ${busId} can only be received at "${centralBus.transferTo}".`);
                }
                centralBus.loc = depotId;
                centralBus.entry = true;
                centralBus.entryDepot = depotId;
                centralBus.entryAt = new Date().toISOString();
                centralBus.transferTo = null;
                centralBus.transferFrom = null;
                centralBus.transferStatus = null;
                if (Array.isArray(multi.log)) {
                    multi.log.unshift({
                        t: new Date().toLocaleTimeString('en-GB'),
                        m: `Bus ${busId} (${centralBus.reg || data[busId].regNo}) entered at ${depotId} (via Entry Recorder UI)`,
                        d: [depotId]
                    });
                    multi.log = multi.log.slice(0, 300);
                }
                saveMultiDepotState(multi);
            } else if (depotId !== 'chandapura') {
                throw new Error(`Bus ${busId} has no linked fleet record for ${depotId}`);
            }
            data[busId].entryApproved = true;
            data[busId].depotId = depotId;
            data[busId].approvedAt = new Date().toISOString();
            data[busId].operator = operator;
            saveDB(DB_KEYS.ENTRY_RECORDER, data);

            CleanerDB.syncFromEntry(data[busId]);
            ChargingDB.syncFromEntry(data[busId]);
            window.dispatchEvent(new CustomEvent('fleet-db-updated', { detail: { stage: 'entry', busId, depotId } }));
            return data[busId];
        },

        reset() {
            localStorage.removeItem(DB_KEYS.ENTRY_RECORDER);
            return this.init();
        }
    };

    // =========================================================================
    // 2. Cleaner Database
    // =========================================================================
    const CleanerDB = {
        name: 'CleanerDatabase',
        table: 'cleaner_buses',

        init() {
            let data = loadDB(DB_KEYS.CLEANER, null);
            if (!data) {
                data = {};
                saveDB(DB_KEYS.CLEANER, data);
            }
            return data;
        },

        // Sync bus when approved by Entry Recorder
        syncFromEntry(busRecord) {
            const data = this.init();
            if (!data[busRecord.busId]) {
                data[busRecord.busId] = {
                    busId: busRecord.busId,
                    regNo: busRecord.regNo,
                    cat: busRecord.cat,
                    actualRange: busRecord.actualRange,
                    depotId: busRecord.depotId || 'chandapura',
                    cleanApproved: false,
                    cleanedAt: null,
                    operator: null
                };
                saveDB(DB_KEYS.CLEANER, data);
            } else {
                data[busRecord.busId].depotId = busRecord.depotId || 'chandapura';
                saveDB(DB_KEYS.CLEANER, data);
            }
        },

        getAll() {
            return Object.values(this.init());
        },

        // Buses that have entered depot but not yet cleaned
        getPending(depotId = 'chandapura') {
            return this.getAll().filter(b => !b.cleanApproved && (b.depotId || 'chandapura') === depotId);
        },

        approveBus(busId, operator = 'Cleaning Staff', depotId = 'chandapura') {
            if (IssuesDB.isHeld(busId)) throw new Error('Bus has an unresolved reported problem');
            if (this.init()[busId]?.cleanApproved) throw new Error('This bus was already approved. Refresh the list.');
            const data = this.init();
            if (!data[busId] || (data[busId].depotId || 'chandapura') !== depotId) {
                throw new Error(`Bus ${busId} is not pending in the Cleaner database for ${depotId}`);
            }

            data[busId].cleanApproved = true;
            data[busId].cleanedAt = new Date().toISOString();
            data[busId].operator = operator;
            saveDB(DB_KEYS.CLEANER, data);
            syncMultiDepotBus(busId, { clean: true, cleanedAt: data[busId].cleanedAt },
                `Bus ${busId} cleaning approved`);

            // Check if Charging has also approved -> if so, bus enters Scheduler
            SchedulerDB.checkAndEnroll(busId);

            window.dispatchEvent(new CustomEvent('fleet-db-updated', { detail: { stage: 'cleaner', busId } }));
            return data[busId];
        }
    };

    // =========================================================================
    // 3. Charging Database
    // =========================================================================
    const ChargingDB = {
        name: 'ChargingDatabase',
        table: 'charging_buses',

        init() {
            let data = loadDB(DB_KEYS.CHARGING, null);
            if (!data) {
                data = {};
                saveDB(DB_KEYS.CHARGING, data);
            }
            return data;
        },

        // Sync bus when approved by Entry Recorder
        syncFromEntry(busRecord) {
            const data = this.init();
            if (!data[busRecord.busId]) {
                data[busRecord.busId] = {
                    busId: busRecord.busId,
                    regNo: busRecord.regNo,
                    cat: busRecord.cat,
                    actualRange: busRecord.actualRange,
                    depotId: busRecord.depotId || 'chandapura',
                    chargeApproved: false,
                    chargedAt: null,
                    operator: null
                };
                saveDB(DB_KEYS.CHARGING, data);
            } else {
                data[busRecord.busId].depotId = busRecord.depotId || 'chandapura';
                saveDB(DB_KEYS.CHARGING, data);
            }
        },

        getAll() {
            return Object.values(this.init());
        },

        // Buses that have entered depot but not yet charge approved
        getPending(depotId = 'chandapura') {
            return this.getAll().filter(b => !b.chargeApproved && (b.depotId || 'chandapura') === depotId);
        },

        approveBus(busId, operator = 'Charging Incharge', depotId = 'chandapura') {
            if (IssuesDB.isHeld(busId)) throw new Error('Bus has an unresolved reported problem');
            if (this.init()[busId]?.chargeApproved) throw new Error('This bus was already approved. Refresh the list.');
            const data = this.init();
            if (!data[busId] || (data[busId].depotId || 'chandapura') !== depotId) {
                throw new Error(`Bus ${busId} is not pending in the Charging database for ${depotId}`);
            }

            data[busId].chargeApproved = true;
            data[busId].chargedAt = new Date().toISOString();
            data[busId].operator = operator;
            saveDB(DB_KEYS.CHARGING, data);
            syncMultiDepotBus(busId, { charge: true, chargedAt: data[busId].chargedAt },
                `Bus ${busId} charging approved`);

            // Check if Cleaner has also approved -> if so, bus enters Scheduler
            SchedulerDB.checkAndEnroll(busId);

            window.dispatchEvent(new CustomEvent('fleet-db-updated', { detail: { stage: 'charging', busId } }));
            return data[busId];
        }
    };

    // =========================================================================
    // 4. Scheduler Database & Route-Based Automatic Assignment Engine
    // =========================================================================

    // Default pool of drivers with Senior qualification
    const DEFAULT_SENIOR_DRIVERS = new Set([
        'Ramesh Gowda', 'Suresh Kumar', 'Manjunath B', 'Shivakumar N',
        'Venkatesh R', 'Anand Patil', 'Basavaraj M', 'Raghavendra K',
        'Chandrashekar H', 'Nagaraj V', 'Someshwara Reddy', 'Pradeep Rao'
    ]);

    function parseTimeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const parts = timeStr.trim().split(':').map(Number);
        return (parts[0] || 0) * 60 + (parts[1] || 0);
    }

    function schedulesOverlap(sch1, sch2) {
        if (!sch1 || !sch2) return false;
        if (sch1.id && sch2.id && sch1.id === sch2.id) return true;

        let start1 = parseTimeToMinutes(sch1.departure || '00:00');
        let end1 = parseTimeToMinutes(sch1.arrival || '23:59');
        let start2 = parseTimeToMinutes(sch2.departure || '00:00');
        let end2 = parseTimeToMinutes(sch2.arrival || '23:59');

        if (end1 <= start1) end1 += 1440;
        if (end2 <= start2) end2 += 1440;

        return Math.max(start1, start2) < Math.min(end1, end2);
    }

    function isDriverEligible(driverName, schedule, options = {}) {
        if (!driverName) return false;
        const req = (schedule && schedule.driverReq) ? schedule.driverReq : 'Standard';
        if (req === 'Senior') {
            const seniorList = options.seniorDrivers || DEFAULT_SENIOR_DRIVERS;
            if (seniorList instanceof Set) {
                return seniorList.has(driverName);
            }
            if (Array.isArray(seniorList)) {
                return seniorList.includes(driverName);
            }
            return false;
        }
        return true;
    }

    const SchedulerDB = {
        name: 'SchedulerDatabase',
        table: 'scheduler_ready_buses',

        init() {
            let data = loadDB(DB_KEYS.SCHEDULER, null);
            if (!data) {
                data = {};
                saveDB(DB_KEYS.SCHEDULER, data);
            }
            return data;
        },

        /**
         * FLOW RULE 2.1:
         * Cleaner AND Charging incharge: yes from BOTH of them -->> Scheduler
         */
        checkAndEnroll(busId) {
            const cleanerData = CleanerDB.init();
            const chargingData = ChargingDB.init();
            const schedulerData = this.init();

            const isClean = cleanerData[busId] && cleanerData[busId].cleanApproved;
            const isCharged = chargingData[busId] && chargingData[busId].chargeApproved;

            if (isClean && isCharged) {
                if (!schedulerData[busId]) {
                    const entryData = EntryRecorderDB.init();
                    const busInfo = entryData[busId] || cleanerData[busId] || {};
                    const baseBus = getBaseFleet().find(b => (b.id || b.busId) === busId) || {};
                    const multi = getMultiDepotState();
                    const centralBus = multi && Array.isArray(multi.buses) ? multi.buses.find(b => (b.id || b.busId) === busId) : null;
                    const depotId = busInfo.depotId || centralBus?.loc || centralBus?.entryDepot || baseBus.depotId || 'chandapura';
                    const depotName = (multi?.depots || []).find(d => d.id === depotId)?.name || baseBus.depot || (depotId === 'chandapura' ? 'Depot 44 (Chandapura)' : depotId);
                    schedulerData[busId] = {
                        busId: busId,
                        regNo: busInfo.regNo || baseBus.regNo || baseBus.reg || 'N/A',
                        cat: busInfo.cat || baseBus.cat || 'B',
                        actualRange: Number(busInfo.actualRange || baseBus.actualRange || 85.0),
                        driver: busInfo.driver || baseBus.driver || null,
                        enrolledAt: new Date().toISOString(),
                        scheduleAssigned: null,
                        assignedDriver: null,
                        assignedAt: null,
                        depot: depotName,
                        depotId
                    };
                    saveDB(DB_KEYS.SCHEDULER, schedulerData);
                }
            }
        },

        getAll() {
            return Object.values(this.init());
        },

        /**
         * Retrieve ready pool with full cross-depot awareness.
         * A bus is available at targetDepotId if:
         * 1. Associated with targetDepotId (via linkedDepots or current depot entry)
         * 2. Not entered at another depot
         * 3. Not in transit to another depot
         * 4. Not in maintenance and no defect hold
         * Crucially: A bus is NOT excluded solely because its primary depot differs from targetDepotId.
         */
        getReadyPool(targetDepotId = 'Depot 44 (Chandapura)', options = {}) {
            const targetDepotKey = targetDepotId === 'Depot 44 (Chandapura)' ? 'chandapura' : targetDepotId;
            // Sweep local approvals
            const cleanerData = CleanerDB.init();
            const chargingData = ChargingDB.init();
            Object.keys(cleanerData).forEach(busId => {
                if (cleanerData[busId].cleanApproved && chargingData[busId]?.chargeApproved) {
                    this.checkAndEnroll(busId);
                }
            });

            // Inspect central multi-depot state sfos_multi_v2 if available
            const multiState = getMultiDepotState();
            if (multiState && Array.isArray(multiState.buses)) {
                const schedData = this.init();
                multiState.buses.forEach(mb => {
                    const id = mb.id || mb.busId;
                    const linked = Array.isArray(mb.linkedDepots) ? mb.linkedDepots : [mb.depotId || mb.depot || targetDepotKey];
                    const isLinked = linked.includes(targetDepotKey) || linked.includes(targetDepotId);
                    const depotAliases = new Set([targetDepotKey, targetDepotId]);
                    const enteredHere = mb.entry && [...depotAliases].some(key => mb.entry[key]?.approved);
                    const enteredElsewhere = mb.loc && !depotAliases.has(mb.loc) && mb.entry && mb.entry[mb.loc]?.approved;
                    const inTransitElsewhere = mb.transferTo && !depotAliases.has(mb.transferTo);
                    const isMaint = mb.maintenance === true;

                    if ((isLinked || enteredHere) && (mb.entry === true || enteredHere) && mb.clean === true && mb.charge === true && !enteredElsewhere && !inTransitElsewhere && !isMaint) {
                        if (!schedData[id]) {
                            const baseBus = (options.fleet || getBaseFleet()).find(b => (b.id || b.busId) === id) || {};
                            schedData[id] = {
                                busId: id,
                                regNo: mb.reg || baseBus.regNo || baseBus.reg || 'N/A',
                                cat: mb.cat || baseBus.cat || 'B',
                                actualRange: Number(mb.actualRange || baseBus.actualRange || 90.0),
                                driver: mb.driver || baseBus.driver || null,
                                enrolledAt: new Date().toISOString(),
                                scheduleAssigned: mb.assignedSchedule || null,
                                assignedDriver: mb.assignedDriver || null,
                                assignedAt: null,
                                depot: mb.depotId || mb.depot || baseBus.depotId || baseBus.depot || targetDepotKey,
                                depotId: mb.depotId || mb.loc || mb.home || targetDepotKey
                            };
                            saveDB(DB_KEYS.SCHEDULER, schedData);
                        }
                    }
                });
            }

            // Exclude buses with defect hold, maintenance, or already assigned
            const baseFleet = options.fleet || getBaseFleet();
            const pool = this.getAll().filter(b => {
                const recordDepot = b.depotId || (b.depot === 'Depot 44 (Chandapura)' ? 'chandapura' : null);
                const sameDepot = recordDepot ? recordDepot === targetDepotKey || recordDepot === targetDepotId : targetDepotKey === 'chandapura';
                if (!sameDepot || b.scheduleAssigned || IssuesDB.isHeld(b.busId)) return false;
                const physical = multiState?.buses?.find(item => (item.id || item.busId) === b.busId);
                if (physical && typeof physical.entry === 'boolean' && (!physical.entry || !physical.clean || !physical.charge || physical.maintenance || physical.transferTo || physical.loc && ![targetDepotKey,targetDepotId].includes(physical.loc))) return false;
                const baseInfo = baseFleet.find(bf => (bf.id || bf.busId) === b.busId);
                if (baseInfo) {
                    if (baseInfo.maintenance === true) return false;
                    if (baseInfo.hasDefectHold === true) return false;
                }
                return true;
            });

            return pool;
        },

        /**
         * Recommends a suitable and available bus & driver for a given schedule.
         */
        recommendAssignment(scheduleId, options = {}) {
            const targetDepot = options.depotId || 'Depot 44 (Chandapura)';
            const schedulesList = options.schedules || (typeof SCHEDULES !== 'undefined' ? SCHEDULES : (rootScope.SCHEDULES || []));
            const fleetList = options.fleet || getBaseFleet();
            const routesList = options.routes || (typeof ROUTES !== 'undefined' ? ROUTES : (rootScope.ROUTES || []));

            if (!scheduleId) {
                return {
                    success: false,
                    errorType: 'INVALID_SCHEDULE',
                    reason: 'No schedule ID provided.'
                };
            }

            const schedule = schedulesList.find(s => s.id === scheduleId);
            if (!schedule) {
                return {
                    success: false,
                    errorType: 'INVALID_SCHEDULE',
                    reason: `Schedule "${scheduleId}" not found in system schedules.`
                };
            }

            // Determine allowed categories for schedule
            let activeCats = Array.isArray(schedule.allowedCats) && schedule.allowedCats.length > 0 ? schedule.allowedCats : null;
            if (!activeCats) {
                const routeInfo = routesList.find(r => r.id === schedule.route);
                const routeDiff = routeInfo ? routeInfo.category : (schedule.category || 'Moderate');
                const [h, m] = (schedule.departure || "00:00").split(':').map(Number);
                const mins = (h || 0) * 60 + (m || 0);

                let ts = 'Peak';
                if (mins < 420) ts = 'Normal';
                else if (mins >= 420 && mins < 600) ts = 'Extreme Peak';
                else if (mins >= 960 && mins < 1200) ts = 'Extreme Peak';

                if (routeDiff === 'Complex') activeCats = ['A'];
                else if (routeDiff === 'Simple' && ts === 'Normal') activeCats = ['A', 'B', 'C'];
                else activeCats = ['A', 'B'];
            }

            // Retrieve ready pool
            const pool = this.getReadyPool(targetDepot, options);

            // Fetch current assignments to detect overlapping trips
            const currentAssignments = this.getAssignments();
            const scheduleMap = new Map();
            schedulesList.forEach(s => scheduleMap.set(s.id, s));

            const singleChargeReq = Number(schedule.singleChargeReq) || 0;
            const validBuses = pool.filter(bus => {
                // Category match
                if (!activeCats.includes(bus.cat)) return false;
                // Range match
                if (Number(bus.actualRange) < singleChargeReq) return false;
                // Trip overlap check for this bus
                const busAssignments = currentAssignments.filter(a => a.busId === bus.busId);
                for (const asgn of busAssignments) {
                    const assignedSch = scheduleMap.get(asgn.scheduleAssigned);
                    if (assignedSch && schedulesOverlap(assignedSch, schedule)) {
                        return false;
                    }
                }
                return true;
            });

            if (validBuses.length === 0) {
                return {
                    success: false,
                    errorType: 'NO_BUS',
                    schedule,
                    allowedCats: activeCats,
                    singleChargeReq,
                    reason: `No suitable and available bus found for Schedule ${scheduleId} (Route ${schedule.route}). Requires Category in [${activeCats.join(', ')}], range >= ${singleChargeReq} km, operational ready status, and no trip time overlap.`
                };
            }

            // Selection strategy for buses:
            // 1. Category rank (Category preservation: prefer Cat C first, then B, preserve A: C=1, B=2, A=3)
            // 2. Smallest positive battery range buffer (bus.actualRange - singleChargeReq)
            // 3. Bus ID tie-breaker
            validBuses.sort((a, b) => {
                const rank = { 'C': 1, 'B': 2, 'A': 3 };
                const rankDiff = (rank[a.cat] || 2) - (rank[b.cat] || 2);
                if (rankDiff !== 0) return rankDiff;

                const bufA = a.actualRange - singleChargeReq;
                const bufB = b.actualRange - singleChargeReq;
                if (Math.abs(bufA - bufB) > 0.001) return bufA - bufB;

                return String(a.busId).localeCompare(String(b.busId));
            });

            const bestBus = validBuses[0];

            // Identify eligible drivers
            const allDriversSet = new Set();
            fleetList.forEach(b => { if (b.driver) allDriversSet.add(b.driver); });
            if (options.drivers && Array.isArray(options.drivers)) {
                options.drivers.forEach(d => { if (d) allDriversSet.add(typeof d === 'string' ? d : d.driver_name || d.name); });
            }
            if (bestBus.driver) allDriversSet.add(bestBus.driver);

            const allDrivers = Array.from(allDriversSet).sort();

            const eligibleDrivers = allDrivers.filter(driverName => {
                // Qualification check
                if (!isDriverEligible(driverName, schedule, options)) {
                    return false;
                }
                // Schedule time overlap check
                const driverAssignments = currentAssignments.filter(a => a.assignedDriver === driverName);
                for (const asgn of driverAssignments) {
                    const assignedSch = scheduleMap.get(asgn.scheduleAssigned);
                    if (assignedSch && schedulesOverlap(assignedSch, schedule)) {
                        return false;
                    }
                }
                return true;
            });

            if (eligibleDrivers.length === 0) {
                return {
                    success: false,
                    errorType: 'NO_DRIVER',
                    bus: bestBus,
                    schedule,
                    reason: `No eligible driver available for Schedule ${scheduleId}. Route requires ${schedule.driverReq || 'Standard'} qualification and no trip schedule conflicts.`
                };
            }

            // Selection strategy for driver:
            // 1. If bestBus has a default driver and that driver is eligible, preserve that pairing!
            // 2. Else pick first eligible driver from sorted list
            let bestDriver = null;
            if (bestBus.driver && eligibleDrivers.includes(bestBus.driver)) {
                bestDriver = bestBus.driver;
            } else {
                bestDriver = eligibleDrivers[0];
            }

            const bufferKm = Number((bestBus.actualRange - singleChargeReq).toFixed(1));

            return {
                success: true,
                status: 'PROPOSED',
                schedule,
                bus: bestBus,
                busCandidates: validBuses.slice(0, 3),
                driver: bestDriver,
                bufferKm,
                reason: `Recommended Bus ${bestBus.busId} (${bestBus.regNo}, Cat ${bestBus.cat}) with +${bufferKm} km safety buffer and Driver ${bestDriver} (${schedule.driverReq || 'Standard'} qualified).`
            };
        },

        assignBus(busId, scheduleId, driverName, options = {}) {
            if (IssuesDB.isHeld(busId)) throw new Error(`Bus ${busId} has an unresolved reported problem`);
            const data = this.init();
            if (!data[busId]) {
                throw new Error(`Bus ${busId} is not in the Scheduler Ready Pool`);
            }
            if (options.depotId && data[busId].depotId && data[busId].depotId !== options.depotId) {
                throw new Error(`Depot access error: Bus ${busId} is assigned to depot ${data[busId].depotId}`);
            }

            const schedulesList = options.schedules || (typeof SCHEDULES !== 'undefined' ? SCHEDULES : (rootScope.SCHEDULES || []));
            const scheduleMap = new Map();
            schedulesList.forEach(s => scheduleMap.set(s.id, s));
            const targetSchedule = scheduleMap.get(scheduleId);

            // Re-validate atomic concurrency:
            // 1. Bus must not be already assigned to an overlapping active schedule
            if (data[busId].scheduleAssigned) {
                const existingSch = scheduleMap.get(data[busId].scheduleAssigned);
                if (!targetSchedule || !existingSch || schedulesOverlap(existingSch, targetSchedule) || data[busId].scheduleAssigned === scheduleId) {
                    throw new Error(`Concurrency Conflict: Bus ${busId} is already assigned to schedule ${data[busId].scheduleAssigned}`);
                }
            }

            // 2. Driver must not be already committed to an overlapping active schedule
            const currentAssignments = Object.values(data).filter(b => b.scheduleAssigned && b.assignedDriver === driverName && b.busId !== busId);
            for (const asgn of currentAssignments) {
                const existingSch = scheduleMap.get(asgn.scheduleAssigned);
                if (!targetSchedule || !existingSch || schedulesOverlap(existingSch, targetSchedule)) {
                    throw new Error(`Concurrency Conflict: Driver ${driverName} is already committed to an overlapping trip (${asgn.scheduleAssigned})`);
                }
            }

            // 3. Re-validate driver qualification
            if (targetSchedule && !isDriverEligible(driverName, targetSchedule, options)) {
                throw new Error(`Qualification Error: Route requires a Senior qualified driver, but ${driverName} is not eligible`);
            }

            // 4. Re-validate bus range & operational status
            const baseFleet = options.fleet || getBaseFleet();
            const baseBus = baseFleet.find(b => (b.id || b.busId) === busId);
            if (baseBus && (baseBus.maintenance === true || baseBus.hasDefectHold === true)) {
                throw new Error(`Operational Error: Bus ${busId} is currently under maintenance or defect hold`);
            }
            if (targetSchedule && Number(data[busId].actualRange) < Number(targetSchedule.singleChargeReq || 0)) {
                throw new Error(`Range Error: Bus ${busId} actual range (${data[busId].actualRange} km) is below required ${targetSchedule.singleChargeReq} km`);
            }

            // Commit assignment atomically
            data[busId].scheduleAssigned = scheduleId;
            data[busId].assignedDriver = driverName;
            data[busId].assignedAt = new Date().toISOString();
            saveDB(DB_KEYS.SCHEDULER, data);

            // Sync with sfos_multi_v2 central state if present
            try {
                const multi = getMultiDepotState();
                if (multi && Array.isArray(multi.buses)) {
                    const mb = multi.buses.find(b => (b.id || b.busId) === busId);
                    if (mb) {
                        mb.assignedSchedule = scheduleId;
                        mb.assignedDriver = driverName;
                        mb.route = scheduleId;
                        mb.driver = driverName;
                        const depotId = mb.loc || mb.entryDepot || mb.home;
                        if (Array.isArray(multi.log)) {
                            multi.log.unshift({ t: new Date().toLocaleTimeString('en-GB'),
                                m: `Bus ${busId} assigned to ${scheduleId} with ${driverName}`,
                                d: depotId ? [depotId] : [] });
                            multi.log = multi.log.slice(0, 300);
                        }
                        saveMultiDepotState(multi);
                    }
                }
            } catch (e) {}

            dispatchFleetEvent('scheduler', { busId, scheduleId, driverName });
            return data[busId];
        },

        unassignBus(busId) {
            const data = this.init();
            if (!data[busId]) return false;

            const prevSchedule = data[busId].scheduleAssigned;
            data[busId].scheduleAssigned = null;
            data[busId].assignedDriver = null;
            data[busId].assignedAt = null;
            saveDB(DB_KEYS.SCHEDULER, data);

            try {
                const multi = getMultiDepotState();
                if (multi && Array.isArray(multi.buses)) {
                    const mb = multi.buses.find(b => (b.id || b.busId) === busId);
                    if (mb) {
                        mb.assignedSchedule = null;
                        mb.assignedDriver = null;
                        mb.route = '';
                        mb.driver = '';
                        const depotId = mb.loc || mb.entryDepot || mb.home;
                        if (Array.isArray(multi.log)) {
                            multi.log.unshift({ t: new Date().toLocaleTimeString('en-GB'),
                                m: `Bus ${busId} unassigned from ${prevSchedule || 'schedule'}`,
                                d: depotId ? [depotId] : [] });
                            multi.log = multi.log.slice(0, 300);
                        }
                        saveMultiDepotState(multi);
                    }
                }
            } catch (e) {}

            dispatchFleetEvent('unassigned', { busId, prevSchedule });
            return true;
        },

        getAssignments() {
            return this.getAll().filter(b => b.scheduleAssigned);
        },

        /**
         * Return a scheduled bus back to depot (reset all databases for reuse)
         * This completes the workflow cycle
         */
        returnToDepot(busId) {
            this.unassignBus(busId);

            // Reset Entry Recorder database
            const entryData = EntryRecorderDB.init();
            if (entryData[busId]) {
                entryData[busId].entryApproved = false;
                entryData[busId].approvedAt = null;
                entryData[busId].operator = null;
                saveDB(DB_KEYS.ENTRY_RECORDER, entryData);
            }

            // Reset Cleaner database
            const cleanerData = CleanerDB.init();
            if (cleanerData[busId]) {
                cleanerData[busId].cleanApproved = false;
                cleanerData[busId].cleanedAt = null;
                cleanerData[busId].operator = null;
                saveDB(DB_KEYS.CLEANER, cleanerData);
            }

            // Reset Charging database
            const chargingData = ChargingDB.init();
            if (chargingData[busId]) {
                chargingData[busId].chargeApproved = false;
                chargingData[busId].chargedAt = null;
                chargingData[busId].operator = null;
                saveDB(DB_KEYS.CHARGING, chargingData);
            }

            const multi = getMultiDepotState();
            const centralBus = multi && Array.isArray(multi.buses)
                ? multi.buses.find(item => (item.id || item.busId) === busId)
                : null;
            if (centralBus) {
                const returnDepot = centralBus.loc || centralBus.entryDepot || centralBus.home || null;
                syncMultiDepotBus(busId, {
                    loc: returnDepot,
                    entry: false,
                    clean: false,
                    charge: false,
                    route: '',
                    driver: '',
                    entryDepot: null,
                    entryAt: null,
                    assignedSchedule: null,
                    assignedDriver: null
                }, `Bus ${busId} returned to depot and reset for next cycle`);
            }

            dispatchFleetEvent('returned_to_depot', { busId });
            return true;
        }
    };

    // Synchronize initial state across all 4 databases on load
    function initAllDatabases() {
        EntryRecorderDB.init();
        CleanerDB.init();
        ChargingDB.init();
        SchedulerDB.init();

        // Propagate any pre-existing entry approvals
        const entryAll = EntryRecorderDB.getAll();
        entryAll.forEach(b => {
            if (b.entryApproved) {
                CleanerDB.syncFromEntry(b);
                ChargingDB.syncFromEntry(b);
            }
        });

        // Enroll any already double-approved buses
        const cleanerAll = CleanerDB.getAll();
        const chargingData = ChargingDB.init();
        cleanerAll.forEach(b => {
            if (b.cleanApproved && chargingData[b.busId]?.chargeApproved) {
                SchedulerDB.checkAndEnroll(b.busId);
            }
        });
    }

    // Reset all databases back to factory depot state
    function resetAllDatabases() {
        const store = getStorage();
        store.removeItem(DB_KEYS.ENTRY_RECORDER);
        store.removeItem(DB_KEYS.CLEANER);
        store.removeItem(DB_KEYS.CHARGING);
        store.removeItem(DB_KEYS.SCHEDULER);
        initAllDatabases();
    }

    // Expose to rootScope
    rootScope.FleetDB = {
        Issues: IssuesDB,
        EntryRecorder: EntryRecorderDB,
        Cleaner: CleanerDB,
        Charging: ChargingDB,
        Scheduler: SchedulerDB,
        initAll: initAllDatabases,
        resetAll: resetAllDatabases,
        isTimeOverlapping: schedulesOverlap,
        isDriverEligible: isDriverEligible,
        parseTimeToMinutes: parseTimeToMinutes,
        DEFAULT_SENIOR_DRIVERS: DEFAULT_SENIOR_DRIVERS
    };

    // Auto-initialize on load
    if (typeof document !== 'undefined' && document) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAllDatabases);
        } else {
            initAllDatabases();
        }
    } else {
        initAllDatabases();
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

if (typeof module !== 'undefined' && module.exports) {
    module.exports = (typeof window !== 'undefined' ? window.FleetDB : (typeof global !== 'undefined' ? global.FleetDB : {}));
}
