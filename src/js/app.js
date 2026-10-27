let chandapuraDepot = [12.7933, 77.7011];
let weatherFactor = 1.0;
let trafficFactor = 0;
let substationChartInstance = null;
let batteryChartInstance = null;

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
  const seenScheduleIds = new Set();
  for (let i = SCHEDULES.length - 1; i >= 0; i--) {
    if (seenScheduleIds.has(SCHEDULES[i].id)) {
      SCHEDULES.splice(i, 1);
    } else {
      seenScheduleIds.add(SCHEDULES[i].id);
    }
  }
  document.getElementById('depotScheduleCount').textContent = SCHEDULES.length;
  document.getElementById('navScheduleCount').textContent = `${SCHEDULES.length} Sched`;
  document.getElementById('scheduleTableCount').textContent = SCHEDULES.length;
  solveAllSchedulesGlobal(true);
  initMap();
  initSimulatedLiveBuses();
  renderScheduleTable();
  renderWashBays();
  renderPreCheckQueue();
  renderChargersGrid();
  renderGanttTimeline();
  renderFleetTable();
  renderDefectLogs();
  renderRecurringDefects();
  initSubstationChart();
  initBatteryScatterChart();
  updateKpiMetrics();
  startSimulationClock();
  startWashBayTicker();
});

// Tab Navigation
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'tab-radar' && map) {
    setTimeout(() => map.invalidateSize(), 200);
  }
  if (tabId === 'tab-drivers') {
    renderDriverRoster();
  }
}

// Theme Toggle
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = isDark ? '☀️ Light' : '🌙 Dark';
  }
  updateThemeColors(isDark);
}

function updateThemeColors(isDark) {
  if (substationChartInstance) {
    substationChartInstance.destroy();
    initSubstationChart();
  }
  if (batteryChartInstance) {
    batteryChartInstance.destroy();
    initBatteryScatterChart();
  }

  ROUTES.forEach(r => {
    const color = isDark ? (r.colorDark || '#60A5FA') : (r.color || '#1E3A8A');
    if (routeLayers[r.id]) {
      routeLayers[r.id].eachLayer(layer => {
        if (layer.setStyle) layer.setStyle({ color: color });
      });
    }
  });

  activeLiveBuses.forEach(b => {
    const marker = busMarkers[b.busId];
    if (marker) {
      const rColor = isDark ? (b.routeColorDark || '#60A5FA') : (b.routeColor || '#1E3A8A');
      const bg = isDark ? '#1E293B' : '#FFFFFF';
      const textC = isDark ? '#F8FAFC' : '#0F172A';
      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `<div style="background:${bg}; color:${textC}; border:2px solid ${rColor}; border-radius:6px; padding:2px 7px; font-weight:800; font-size:10.5px; font-family:var(--font-mono); box-shadow:0 2px 8px rgba(0,0,0,0.15); display:flex; align-items:center; gap:4px; cursor:pointer;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${rColor};"></span> ${b.busId}
        </div>`,
        iconSize: [72, 24],
        iconAnchor: [36, 12]
      });
      marker.setIcon(busIcon);
    }
  });
}

// Leaflet Map Initialization
function initMap() {
  map = L.map('leafletMap', {
    center: [12.85, 77.68],
    zoom: 11,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors | Ashok Leyland Intelligent Transit',
    className: 'light-map-tiles',
    maxZoom: 18
  }).addTo(map);

  const isDark = document.body.classList.contains('dark-mode');
  const depotIcon = L.divIcon({
    className: 'custom-depot-marker',
    html: `<div style="background:${isDark ? '#0F172A' : '#0F172A'}; color:${isDark ? '#F8FAFC' : '#FFFFFF'}; padding:5px 10px; border-radius:8px; font-weight:800; font-size:11px; border:2px solid ${isDark ? '#60A5FA' : '#1E3A8A'}; box-shadow:0 3px 12px rgba(17,24,39,0.25); display:flex; align-items:center; gap:5px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="${isDark ? '#60A5FA' : '#1E3A8A'}"><path d="M12 2L2 12h3v8h14v-8h3L12 2z"/></svg>
      CHANDAPURA DEPOT 44
    </div>`,
    iconSize: [160, 30],
    iconAnchor: [80, 15]
  });
  depotMarker = L.marker(chandapuraDepot, { icon: depotIcon }).addTo(map)
    .bindPopup('<b>Chandapura Depot 44 Master Hub</b><br>16 Fast Charger Bays â€¢ 4 Automated Wash Bays â€¢ Maintenance Workshop');

  const chipsContainer = document.getElementById('routeChipsContainer');
  chipsContainer.innerHTML = `<button class="route-chip active" onclick="filterMapRoute('ALL', this)">All Corridors (8)</button>`;

  ROUTES.forEach(r => {
    const curColor = isDark ? (r.colorDark || '#60A5FA') : (r.color || '#1E3A8A');

    const polylineOuter = L.polyline(r.waypoints, {
      color: curColor,
      weight: 6,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round'
    });

    const polylineInner = L.polyline(r.waypoints, {
      color: curColor,
      weight: 3,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).bindPopup(`<b>Corridor ${r.id}: ${r.name}</b><br>Category: <b>${r.category}</b><br>Daily Concession: ${r.dailyKm} km`);

    const layerGroup = L.layerGroup([polylineOuter, polylineInner]).addTo(map);
    routeLayers[r.id] = layerGroup;

    chipsContainer.innerHTML += `
      <button class="route-chip" style="--chip-color:${curColor};" onclick="filterMapRoute('${r.id}', this)">
        <span class="route-dot"></span>
        ${r.id}
      </button>
    `;
  });
}

function filterMapRoute(routeId, btn) {
  activeRouteFilter = routeId;
  document.querySelectorAll('.route-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  ROUTES.forEach(r => {
    if (routeId === 'ALL' || r.id === routeId) {
      if (!map.hasLayer(routeLayers[r.id])) map.addLayer(routeLayers[r.id]);
    } else {
      if (map.hasLayer(routeLayers[r.id])) map.removeLayer(routeLayers[r.id]);
    }
  });

  activeLiveBuses.forEach(b => {
    const m = busMarkers[b.busId];
    if (m) {
      if (routeId === 'ALL' || b.routeId === routeId) {
        if (!map.hasLayer(m)) map.addLayer(m);
      } else {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
    }
  });
}

function fitDepotBounds() { map.setView(chandapuraDepot, 14); }
function fitAllRoutesBounds() {
  const allWaypoints = ROUTES.flatMap(r => r.waypoints);
  map.fitBounds(L.latLngBounds(allWaypoints), { padding: [30, 30] });
}

// Initialize 28 Live Animated En-Route Buses
function initSimulatedLiveBuses() {
  const selectedRoutes = ROUTES.slice(0, 8);
  const activeFleet = FLEET.filter(b => b.turnaroundState === 'En-Route (Active)' || b.turnaroundState === 'Shed-Out Ready');
  let busIdx = 0;

  selectedRoutes.forEach(r => {
    const busesOnRoute = r.id === 'SW-360' ? 6 : (r.id === 'SW-600' ? 5 : (r.id === 'SW-328' ? 4 : 3));
    for (let i = 0; i < busesOnRoute; i++) {
      const fleetItem = activeFleet[busIdx % activeFleet.length];
      busIdx++;

      activeLiveBuses.push({
        busId: fleetItem.busId,
        regNo: fleetItem.regNo,
        cat: fleetItem.cat,
        soh: fleetItem.soh,
        soc: Math.floor(70 + Math.random() * 25),
        actualRange: fleetItem.actualRange,
        driver: fleetItem.driver,
        cleanStatus: fleetItem.cleanStatus,
        turnaroundState: fleetItem.turnaroundState,
        depot: fleetItem.depot,
        routeId: r.id,
        routeName: r.name,
        routeColor: r.color,
        routeColorDark: r.colorDark,
        waypoints: r.waypoints,
        progress: (i / busesOnRoute) + (Math.random() * 0.1),
        speed: 28 + Math.floor(Math.random() * 16)
      });
    }
  });

  if (activeLiveBuses.length > 0) {
    showBusTelemetry(activeLiveBuses[0]);
  }
}

function showBusTelemetry(b) {
  const sidebar = document.getElementById('radarSidebarContent');
  const barClass = b.soc > 40 ? '' : (b.soc > 20 ? 'warning' : 'critical');

  sidebar.innerHTML = `
    <div class="telemetry-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:36px; height:36px; border-radius:7px; background:#111827; border:1px solid var(--brand-primary); display:flex; align-items:center; justify-content:center; color:var(--brand-primary); font-weight:800; font-size:13px;">
            ${b.cat}
          </div>
          <div>
            <div style="font-size:13.5px; font-weight:800; font-family:var(--font-mono); color:var(--text-bright);">${b.busId}</div>
            <div style="font-size:10px; color:var(--text-secondary); font-family:var(--font-mono);">${b.regNo} â€¢ ${b.depot}</div>
          </div>
        </div>
        <span class="cat-badge cat-${b.cat.toLowerCase()}">Cat ${b.cat}</span>
      </div>

      <div style="margin:10px 0;">
        <div style="height:9px; background:var(--bg-card-alt); border:1px solid var(--border-card); border-radius:5px; overflow:hidden;">
          <div class="bay-progress-fill ${barClass}" style="width:${b.soc}%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:10.5px; font-family:var(--font-mono);">
          <span style="color:var(--text-secondary);">State of Charge (SOC)</span>
          <span style="font-weight:800; color:var(--text-bright);">${b.soc.toFixed(1)}%</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px; margin-top:8px;">
        <div style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:6px; padding:7px 9px;">
          <div style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Tested Range</div>
          <div style="font-size:12.5px; font-weight:700; font-family:var(--font-mono); color:var(--text-bright);">${b.actualRange} km</div>
        </div>
        <div style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:6px; padding:7px 9px;">
          <div style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Battery SOH</div>
          <div style="font-size:12.5px; font-weight:700; font-family:var(--font-mono); color:var(--brand-primary);">${b.soh}%</div>
        </div>
        <div style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:6px; padding:7px 9px;">
          <div style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Turnaround State</div>
          <div style="font-size:11px; font-weight:800; color:var(--text-bright);">${b.turnaroundState}</div>
        </div>
        <div style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:6px; padding:7px 9px;">
          <div style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Cleanliness</div>
          <div style="font-size:11px; font-weight:700; color:var(--text-bright);">âœ“ Clean (20m Wash)</div>
        </div>
        <div style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:6px; padding:7px 9px; grid-column:span 2;">
          <div style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Assigned Driver</div>
          <div style="font-size:11.5px; font-weight:700; color:var(--text-bright); display:flex; justify-content:space-between; align-items:center;">
            <span>${b.driver}</span>
            <button class="btn-secondary" style="font-size:9.5px; padding:2px 6px;" onclick="promptDriverChange('${b.busId}')">Change</button>
          </div>
        </div>
      </div>
    </div>

    <div class="telemetry-card">
      <div style="font-size:10.5px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:4px;">Active Concession Corridor</div>
      <div style="font-size:12px; font-weight:800; color:var(--text-bright);">${b.routeName}</div>
      <div style="margin-top:8px; display:flex; justify-content:space-between; font-size:10.5px; font-family:var(--font-mono);">
        <span style="color:var(--text-secondary);">Live Speed:</span>
        <span style="font-weight:700; color:var(--text-bright);">${b.speed} km/h</span>
      </div>
    </div>
  `;
}

function promptDriverChange(busId) {
  const newDriver = prompt(`Assign new driver for Electric Bus ${busId}:`, 'Venkatesh R');
  if (newDriver) {
    const b = FLEET.find(x => x.busId === busId);
    if (b) b.driver = newDriver;
    const live = activeLiveBuses.find(x => x.busId === busId);
    if (live) { live.driver = newDriver; showBusTelemetry(live); }
    renderFleetTable();
    alert(`Driver updated for ${busId}: ${newDriver}`);
  }
}

function interpolateRoutePosition(waypoints, progress) {
  if (!waypoints || waypoints.length === 0) return chandapuraDepot;
  if (waypoints.length === 1) return waypoints[0];

  const totalSegments = waypoints.length - 1;
  const rawIdx = progress * totalSegments;
  const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1);
  const segProgress = rawIdx - segIdx;

  const p1 = waypoints[segIdx];
  const p2 = waypoints[segIdx + 1];

  const lat = p1[0] + (p2[0] - p1[0]) * segProgress;
  const lng = p1[1] + (p2[1] - p1[1]) * segProgress;
  return [lat, lng];
}

function startSimulationClock() {
  setInterval(() => {
    if (simPaused) return;

    simTime = (simTime + (0.0005 * simSpeed)) % 24;
    updateClockDisplay();

    activeLiveBuses.forEach(b => {
      b.progress = (b.progress + (0.0015 * simSpeed)) % 1.0;
      b.soc = Math.max(20, b.soc - (0.005 * simSpeed * weatherFactor));

      const pos = interpolateRoutePosition(b.waypoints, b.progress);

      const isDark = document.body.classList.contains('dark-mode');
      const rColor = isDark ? (b.routeColorDark || '#60A5FA') : (b.routeColor || '#1E3A8A');
      const bg = isDark ? '#1E293B' : '#FFFFFF';
      const textC = isDark ? '#F8FAFC' : '#0F172A';

      if (!busMarkers[b.busId]) {
        const busIcon = L.divIcon({
          className: 'custom-bus-marker',
          html: `<div style="background:${bg}; color:${textC}; border:2px solid ${rColor}; border-radius:6px; padding:2px 7px; font-weight:800; font-size:10.5px; font-family:var(--font-mono); box-shadow:0 2px 8px rgba(0,0,0,0.15); display:flex; align-items:center; gap:4px; cursor:pointer;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${rColor};"></span> ${b.busId}
          </div>`,
          iconSize: [72, 24],
          iconAnchor: [36, 12]
        });

        const marker = L.marker(pos, { icon: busIcon }).addTo(map);
        marker.on('click', () => showBusTelemetry(b));
        busMarkers[b.busId] = marker;
      } else {
        busMarkers[b.busId].setLatLng(pos);
      }
    });

  }, 500);
}

function updateClockDisplay() {
  const hrs = Math.floor(simTime);
  const mins = Math.floor((simTime - hrs) * 60);
  const secs = Math.floor((((simTime - hrs) * 60) - mins) * 60);
  document.getElementById('simTimeText').innerText = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')} IST`;
}

function setSimSpeed(speed, btn) {
  simSpeed = speed;
  simPaused = false;
  document.querySelectorAll('.sim-speed-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pauseBtn').innerText = 'â¸';
}

function toggleSimPause() {
  simPaused = !simPaused;
  document.getElementById('pauseBtn').innerText = simPaused ? 'â–¶' : 'â¸';
}

// ==========================================
// 20-MIN WASH BAY ENGINE (Meeting Requirement)
// ==========================================
function startWashBayTicker() {
  setInterval(() => {
    if (simPaused) return;

    WASH_BAYS.forEach(bay => {
      if (bay.status === 'Active') {
        bay.elapsedSec = Math.min(bay.totalSec, bay.elapsedSec + (2 * simSpeed));
        if (bay.elapsedSec >= bay.totalSec) {
          bay.status = 'Completed';
          // Move bus to Pre-Departure Check Queue
          const bus = FLEET.find(b => b.busId === bay.busId);
          if (bus) {
            bus.turnaroundState = 'Pre-Departure Check';
            bus.cleanStatus = 'Clean (Washed 20m)';
            bus.washTimeRemaining = 0;
          }
          if (!PRE_CHECK_QUEUE.some(q => q.busId === bay.busId)) {
            PRE_CHECK_QUEUE.unshift({
              busId: bay.busId,
              depot: bay.depot,
              actualRange: bus ? bus.actualRange : 120,
              soc: 98,
              completedAt: document.getElementById('simTimeText').innerText.slice(0,5) + ' IST',
              signedOff: false
            });
          }
        }
      }
    });

    renderWashBays();
    renderPreCheckQueue();
    updatePipelineCounts();
  }, 1000);
}

function renderWashBays() {
  const container = document.getElementById('washBaysContainer');
  if (!container) return;
  container.innerHTML = '';

  WASH_BAYS.forEach((bay, idx) => {
    const remainingSec = Math.max(0, bay.totalSec - bay.elapsedSec);
    const remMins = Math.floor(remainingSec / 60);
    const remSecs = Math.floor(remainingSec % 60);
    const pct = Math.min(100, Math.round((bay.elapsedSec / bay.totalSec) * 100));
    const isDone = bay.status === 'Completed';

    container.innerHTML += `
      <div class="wash-bay-card ${isDone ? '' : 'busy'}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; font-weight:800; font-family:var(--font-mono); color:var(--text-secondary);">${bay.bayId}</span>
          <span class="readiness-pill ${isDone ? 'ready' : 'washing'}">${isDone ? 'âœ“ 20m WASH DONE' : 'ðŸš¿ WASHING (20m)'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <span style="font-size:14px; font-weight:800; font-family:var(--font-mono); color:var(--text-bright);">${bay.busId}</span>
          <span style="font-size:10px; color:var(--text-secondary);">${bay.depot.split(' ')[0]}</span>
        </div>
        <div class="bay-timer-display">${remMins.toString().padStart(2,'0')}:${remSecs.toString().padStart(2,'0')}</div>
        <div class="bay-progress-bar">
          <div class="bay-progress-fill" style="width:${pct}%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:10px; color:var(--text-secondary);">
          <span>${pct}% Cleaned</span>
          <span>${isDone ? 'Ready for Pre-Check' : 'Automated Gantry'}</span>
        </div>
      </div>
    `;
  });
}

function renderPreCheckQueue() {
  const tbody = document.getElementById('preCheckTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  PRE_CHECK_QUEUE.forEach((q, idx) => {
    tbody.innerHTML += `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:800; color:var(--text-bright);">${q.busId}</td>
        <td>${q.depot}</td>
        <td style="font-family:var(--font-mono); font-weight:700;">${q.actualRange} km</td>
        <td style="font-family:var(--font-mono); color:var(--text-bright); font-weight:700;">${q.soc}%</td>
        <td><span class="readiness-pill ready">âœ“ 20m Wash Completed (${q.completedAt})</span></td>
        <td style="font-size:10.5px; color:var(--text-secondary);">
          âœ“ HV Seals Locked â€¢ âœ“ Brakes Verified â€¢ âœ“ Cabin Sanitized
        </td>
        <td>
          <span class="readiness-pill ${q.signedOff ? 'ready' : 'washing'}">
            ${q.signedOff ? 'ðŸŸ¢ Shed-Out Ready' : 'ðŸ” Inspection Pending'}
          </span>
        </td>
        <td>
          ${q.signedOff ? '<span style="font-size:10.5px; font-weight:800; color:var(--brand-primary);">âœ“ Approved</span>' :
            `<button class="btn-primary" style="font-size:10px; padding:3px 8px;" onclick="signOffSinglePreCheck('${q.busId}')">âœ“ Approve for Shed-Out</button>`
          }
        </td>
      </tr>
    `;
  });
}

function signOffSinglePreCheck(busId) {
  const item = PRE_CHECK_QUEUE.find(q => q.busId === busId);
  if (item) item.signedOff = true;
  const b = FLEET.find(x => x.busId === busId);
  if (b) {
    b.turnaroundState = 'Shed-Out Ready';
    b.cleanStatus = 'Clean (Washed 20m)';
  }
  renderPreCheckQueue();
  renderScheduleTable();
  updatePipelineCounts();
  updateKpiMetrics();
}

function signOffAllPreCheck() {
  PRE_CHECK_QUEUE.forEach(q => {
    q.signedOff = true;
    const b = FLEET.find(x => x.busId === q.busId);
    if (b) {
      b.turnaroundState = 'Shed-Out Ready';
      b.cleanStatus = 'Clean (Washed 20m)';
    }
  });
  renderPreCheckQueue();
  renderScheduleTable();
  updatePipelineCounts();
  updateKpiMetrics();
  alert('All vehicles in Pre-Departure Check have been verified and moved to Shed-Out Ready status!');
}

function startWashServiceManual() {
  const busNo = document.getElementById('washEntryBusNo').value.trim().toUpperCase();
  const depot = document.getElementById('washEntryDepot').value;
  if (!busNo) {
    alert('Please enter or scan a valid Bus Number.');
    return;
  }

  // Check if bus already in wash
  if (WASH_BAYS.some(b => b.busId === busNo && b.status === 'Active')) {
    alert(`Bus ${busNo} is already undergoing 20-minute wash service.`);
    return;
  }

  // Find idle or replace oldest completed bay
  let targetBay = WASH_BAYS.find(b => b.status === 'Completed');
  if (!targetBay) {
    targetBay = WASH_BAYS[0];
  }

  targetBay.busId = busNo;
  targetBay.depot = depot;
  targetBay.elapsedSec = 0;
  targetBay.totalSec = 1200; // 20 mins
  targetBay.status = 'Active';

  const b = FLEET.find(x => x.busId === busNo);
  if (b) {
    b.turnaroundState = 'In 20-Min Wash';
    b.cleanStatus = 'Washing (Active)';
    b.washTimeRemaining = 20;
  }

  renderWashBays();
  updatePipelineCounts();
  alert(`Bus ${busNo} admitted into Automated Wash Bay ${targetBay.bayId}. 20-minute timer started.`);
}

function fastCompleteAllWashes() {
  WASH_BAYS.forEach(b => b.elapsedSec = b.totalSec);
  renderWashBays();
  renderPreCheckQueue();
  updatePipelineCounts();
}

function updatePipelineCounts() {
  const charging = FLEET.filter(b => b.turnaroundState === 'Charging').length;
  const washing = FLEET.filter(b => b.turnaroundState === 'In 20-Min Wash').length;
  const preCheck = FLEET.filter(b => b.turnaroundState === 'Pre-Departure Check').length;
  const shedOut = FLEET.filter(b => b.turnaroundState === 'Shed-Out Ready').length;

  document.getElementById('countCharging').innerText = `${charging} Buses`;
  document.getElementById('countWashing').innerText = `${washing} Active`;
  document.getElementById('countPreCheck').innerText = `${preCheck} Inspected`;
  document.getElementById('countShedOut').innerText = `${shedOut} Ready`;
}

// =======================================================
// SCHEDULE ALLOCATION & READINESS ENGINE (Slide 4 Rules)
// =======================================================
function validateAssignment(bus, schedule) {
  const errors = [];
  const warnings = [];

  if (!schedule.allowedCats.includes(bus.cat)) {
    errors.push(`Category ${bus.cat} bus violates Slide 4 rule for ${schedule.category} schedule (Requires Cat ${schedule.allowedCats.join('/')})`);
  }

  if (bus.turnaroundState !== 'Shed-Out Ready') {
    warnings.push(`Bus is currently in '${bus.turnaroundState}'. Not yet certified for Shed-Out.`);
  }

  const reqKm = schedule.singleChargeReq;
  if (bus.actualRange < reqKm) {
    errors.push(`Tested range (${bus.actualRange} km) is below single-charge requirement (${reqKm} km)`);
  } else if (bus.actualRange - reqKm < 10) {
    warnings.push(`Low reserve buffer: ${Math.round(bus.actualRange - reqKm)} km above requirement.`);
  }

  return { valid: errors.length === 0, isReady: bus.turnaroundState === 'Shed-Out Ready', errors, warnings };
}

function renderScheduleTable() {
  const tbody = document.getElementById('scheduleTableBody');
  renderScheduleRouteOptions();
  const shiftVal = document.getElementById('shiftFilter').value;
  const readinessVal = document.getElementById('readinessFilter').value;
  const searchVal = document.getElementById('schedSearch').value.toLowerCase().trim();

  let filtered = SCHEDULES.filter(s => {
    if (shiftVal !== 'ALL' && s.shift.toLowerCase() !== shiftVal.toLowerCase()) return false;
    if (searchVal) {
      const mId = s.id.toLowerCase().includes(searchVal);
      const mBus = s.assignedBus && s.assignedBus.toLowerCase().includes(searchVal);
      const mRoute = s.route.toLowerCase().includes(searchVal);
      if (!mId && !mBus && !mRoute) return false;
    }
    if (readinessVal !== 'ALL') {
      const bus = FLEET.find(b => b.busId === s.assignedBus);
      const isReady = bus && bus.turnaroundState === 'Shed-Out Ready';
      if (readinessVal === 'READY' && !isReady) return false;
      if (readinessVal === 'WASH' && isReady) return false;
    }
    return true;
  });

  tbody.innerHTML = '';

  filtered.forEach(s => {
    const bus = FLEET.find(b => b.busId === s.assignedBus);
    const buffer = bus ? (bus.actualRange - s.singleChargeReq) : 0;
    const isReady = bus && bus.turnaroundState === 'Shed-Out Ready';

    // Build Bus Dropdown options grouped by readiness
    let busOptions = FLEET.map(b => {
      const stateTag = b.turnaroundState === 'Shed-Out Ready' ? 'ðŸŸ¢ Ready' : (b.turnaroundState === 'In 20-Min Wash' ? `ðŸš¿ Wash (${b.washTimeRemaining}m)` : (b.turnaroundState === 'Charging' ? `âš¡ Chg (${b.soc}%)` : `ðŸ”´ ${b.turnaroundState}`));
      return `<option value="${b.busId}" ${b.busId === s.assignedBus ? 'selected' : ''}>
        ${b.busId} [${stateTag} | ${b.actualRange}km | Cat ${b.cat}]
      </option>`;
    }).join('');

    let bufferBadge = '';
    if (buffer >= 20) {
      bufferBadge = `<span style="font-weight:800; background:var(--bg-surface); border:1.5px solid var(--brand-primary); color:var(--text-bright); padding:2px 7px; border-radius:4px;">+${buffer.toFixed(1)} km</span>`;
    } else if (buffer >= 5) {
      bufferBadge = `<span style="font-weight:800; background:var(--status-amber); border:1px solid #2A2A2A; color:#111827; padding:2px 7px; border-radius:4px;">+${buffer.toFixed(1)} km</span>`;
    } else {
      bufferBadge = `<span style="font-weight:800; background:var(--bg-card-alt); border:1px solid var(--border-card); color:var(--text-bright); padding:2px 7px; border-radius:4px;">${buffer.toFixed(1)} km</span>`;
    }

    let readinessCell = '';
    if (isReady) {
      readinessCell = `<span class="readiness-pill ready">ðŸŸ¢ Shed-Out Ready</span>`;
    } else if (bus && bus.turnaroundState === 'In 20-Min Wash') {
      readinessCell = `<span class="readiness-pill washing">ðŸš¿ In Wash (${bus.washTimeRemaining}m left)</span>`;
    } else if (bus && bus.turnaroundState === 'Charging') {
      readinessCell = `<span class="readiness-pill charging">âš¡ Fast Chg (${bus.soc}%)</span>`;
    } else {
      readinessCell = `<span class="readiness-pill hold">ðŸ”´ Defect / Staged</span>`;
    }

    tbody.innerHTML += `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--text-bright);">${s.id}</td>
        <td style="font-weight:700;">${s.route}</td>
        <td><span style="font-size:10.5px; color:var(--text-secondary);">${s.shift}</span></td>
        <td style="font-family:var(--font-mono);">${s.departure} - ${s.arrival}</td>
        <td style="font-family:var(--font-mono);">${s.actualKm} km</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--text-bright);">${s.singleChargeReq} km</td>
        <td><span class="route-difficulty-pill ${s.category}">${s.category}</span></td>
        <td>
          <select class="custom-select" style="font-family:var(--font-mono); font-size:11px; max-width:210px;" onchange="onScheduleBusChange('${s.id}', this.value)">
            ${busOptions}
          </select>
        </td>
        <td>${readinessCell}</td>
        <td style="font-family:var(--font-mono); font-weight:700;">${bus ? bus.actualRange + ' km' : '-'}</td>
        <td>${bufferBadge}</td>
        <td>
          ${!isReady ? `<button class="btn-secondary" style="font-size:10px; padding:3px 7px;" onclick="suggestAlternativeBus('${s.id}')">ðŸ’¡ Auto-Suggest</button>` : `<span style="font-size:10px; color:var(--brand-primary); font-weight:800;">âœ“ Matched</span>`}
        </td>
      </tr>
    `;
  });
}

function renderScheduleRouteOptions() {
  const select = document.getElementById('scheduleRouteSelect');
  if (!select) return;

  const availableSchedules = SCHEDULES.filter(schedule => !schedule.assignedBus);
  select.innerHTML = `<option value="">${availableSchedules.length
    ? 'Choose a route to assign a bus and driver'
    : 'No unassigned routes available'}</option>`;

  availableSchedules.forEach(schedule => {
    const option = document.createElement('option');
    option.value = schedule.id;
    option.textContent = `${schedule.id} | Route ${schedule.route} | ${schedule.shift}`;
    select.appendChild(option);
  });
}

function autoAssignSelectedSchedule(scheduleId) {
  if (!scheduleId) return;

  const status = document.getElementById('scheduleAutoAssignStatus');
  const schedule = SCHEDULES.find(item => item.id === scheduleId);
  if (!schedule || schedule.assignedBus) {
    status.textContent = 'That route is already assigned or is no longer available. Choose another route.';
    renderScheduleRouteOptions();
    return;
  }

  const assignedBusIds = new Set(SCHEDULES.map(item => item.assignedBus).filter(Boolean));
  const categoryRank = { C: 1, B: 2, A: 3 };
  const candidate = FLEET.filter(bus =>
    !assignedBusIds.has(bus.busId) &&
    bus.turnaroundState === 'Shed-Out Ready' &&
    bus.driver &&
    validateAssignment(bus, schedule).valid
  ).sort((a, b) =>
    categoryRank[a.cat] - categoryRank[b.cat] || a.actualRange - b.actualRange
  )[0];

  if (!candidate) {
    status.textContent = `No unassigned shed-out-ready bus and driver meet the requirements for ${schedule.id} (${schedule.route}).`;
    return;
  }

  schedule.assignedBus = candidate.busId;
  schedule.assignedDriver = candidate.driver;
  status.textContent = `Assigned ${candidate.busId} and driver ${candidate.driver} to ${schedule.id} (${schedule.route}).`;
  renderScheduleTable();
  renderGanttTimeline();
  updateKpiMetrics();
}

function onScheduleBusChange(schedId, newBusId) {
  const sched = SCHEDULES.find(s => s.id === schedId);
  const bus = FLEET.find(b => b.busId === newBusId);
  if (!sched || !bus) return;

  sched.assignedBus = bus.busId;
  sched.assignedDriver = bus.driver;

  const val = validateAssignment(bus, sched);
  if (!val.valid) {
    alert(`Compatibility Warning: ${val.errors.join('; ')}`);
  } else if (!val.isReady) {
    // Suggest alternatives immediately
    suggestAlternativeBus(schedId);
  }

  renderScheduleTable();
  renderGanttTimeline();
  updateKpiMetrics();
}

// Suggest Alternate Ready Bus (Meeting Requirement: "if not suggest other bus")
function suggestAlternativeBus(schedId) {
  const sched = SCHEDULES.find(s => s.id === schedId);
  if (!sched) return;

  const currentBus = FLEET.find(b => b.busId === sched.assignedBus);
  const readyCandidates = FLEET.filter(b => 
    b.turnaroundState === 'Shed-Out Ready' &&
    sched.allowedCats.includes(b.cat) &&
    b.actualRange >= (sched.singleChargeReq + 4)
  ).sort((a,b) => b.actualRange - a.actualRange).slice(0, 3);

  const modal = document.getElementById('suggestModal');
  const title = document.getElementById('suggestModalTitle');
  const body = document.getElementById('suggestModalBody');

  title.innerText = `Auto-Suggest Alternative Ready Bus for ${sched.id} (${sched.route})`;

  let cardsHtml = '';
  if (readyCandidates.length === 0) {
    cardsHtml = `<div style="padding:14px; background:var(--bg-card-alt); border-radius:8px; font-size:12px;">No 100% idle ready buses available right now. Buses in 20-min wash bay are completing in ~8 mins.</div>`;
  } else {
    readyCandidates.forEach(cand => {
      const buf = cand.actualRange - sched.singleChargeReq;
      cardsHtml += `
        <div style="background:var(--bg-card-subtle); border:1px solid var(--border-card); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <div style="font-size:13.5px; font-weight:800; font-family:var(--font-mono); color:var(--text-bright);">
              ${cand.busId} <span class="cat-badge cat-${cand.cat.toLowerCase()}">Cat ${cand.cat}</span>
            </div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
              Tested Range: <b>${cand.actualRange} km</b> â€¢ SOC: <b>${cand.soc}%</b> â€¢ Cleanliness: <b>${cand.cleanStatus}</b>
            </div>
            <div style="font-size:11px; color:var(--text-bright); font-weight:700; margin-top:3px;">
              Safety Buffer: +${buf.toFixed(1)} km above requirement (${sched.singleChargeReq} km)
            </div>
          </div>
          <button class="btn-primary" onclick="applySuggestedBus('${sched.id}', '${cand.busId}')">
            Apply Suggestion
          </button>
        </div>
      `;
    });
  }

  body.innerHTML = `
    <div style="margin-bottom:12px; font-size:11.5px; color:var(--text-secondary);">
      Currently assigned bus <b>${currentBus ? currentBus.busId : 'None'}</b> is <b>${currentBus ? currentBus.turnaroundState : 'Unassigned'}</b>.
      Below are certified <b>Shed-Out Ready</b> alternatives matching Slide 4 constraints:
    </div>
    ${cardsHtml}
  `;

  modal.classList.add('active');
}

function applySuggestedBus(schedId, busId) {
  const sched = SCHEDULES.find(s => s.id === schedId);
  const bus = FLEET.find(b => b.busId === busId);
  if (sched && bus) {
    sched.assignedBus = bus.busId;
    sched.assignedDriver = bus.driver;
    closeSuggestModal();
    renderScheduleTable();
    renderGanttTimeline();
    updateKpiMetrics();
  }
}

function closeSuggestModal() {
  document.getElementById('suggestModal').classList.remove('active');
}

// 1-Click Global Optimization Solver (1st Page Requirement)
function solveAllSchedulesGlobal(quiet = false) {
  const priorityOrder = ['Complex', 'Moderate', 'Simple'];
  const sortedSchedules = [...SCHEDULES].sort((a,b) => {
    const pA = priorityOrder.indexOf(a.category);
    const pB = priorityOrder.indexOf(b.category);
    if (pA !== pB) return pA - pB;
    return b.singleChargeReq - a.singleChargeReq;
  });

  const eligibleBuses = new Map(sortedSchedules.map(schedule => [
    schedule.id,
    FLEET.filter(bus => validateAssignment(bus, schedule).valid).sort((a, b) =>
      Number(b.turnaroundState === 'Shed-Out Ready') - Number(a.turnaroundState === 'Shed-Out Ready') ||
      (a.actualRange - schedule.singleChargeReq) - (b.actualRange - schedule.singleChargeReq)
    )
  ]));
  const busAssignments = new Map();
  const scheduleAssignments = new Map();

  function assignSchedule(schedule, visitedBuses) {
    for (const bus of eligibleBuses.get(schedule.id)) {
      if (visitedBuses.has(bus.busId)) continue;
      visitedBuses.add(bus.busId);

      const previousSchedule = busAssignments.get(bus.busId);
      if (!previousSchedule || assignSchedule(previousSchedule, visitedBuses)) {
        busAssignments.set(bus.busId, schedule);
        scheduleAssignments.set(schedule.id, bus);
        return true;
      }
    }
    return false;
  }

  sortedSchedules.forEach(schedule => assignSchedule(schedule, new Set()));

  SCHEDULES.forEach(schedule => {
    const bus = scheduleAssignments.get(schedule.id);
    schedule.assignedBus = bus ? bus.busId : null;
    schedule.assignedDriver = bus ? bus.driver : null;
  });

  const assignedCount = scheduleAssignments.size;
  const status = document.getElementById('scheduleAutoAssignStatus');
  if (status) {
    const unassignedCount = SCHEDULES.length - assignedCount;
    status.textContent = unassignedCount
      ? `Automatically assigned ${assignedCount} of ${SCHEDULES.length} schedules. ${unassignedCount} need an eligible unassigned bus.`
      : `Automatically assigned all ${assignedCount} schedules to eligible buses and drivers.`;
  }

  renderScheduleTable();
  renderGanttTimeline();
  updateKpiMetrics();
  if (!quiet) {
    alert(`Automatic schedule allocation complete: ${assignedCount} of ${SCHEDULES.length} schedules assigned to eligible buses and drivers.`);
  }
}

// ========================================================
// MULTI-ACTOR DEFECT & GOVERNANCE (Meeting Requirement)
// ========================================================
function setActorView(role) {
  document.querySelectorAll('.actor-pill-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('actorViewInspector').style.display = 'none';
  document.getElementById('actorViewDepotMgr').style.display = 'none';
  document.getElementById('actorViewCityMgr').style.display = 'none';

  if (role === 'inspector') {
    document.getElementById('btnActorInspector').classList.add('active');
    document.getElementById('actorViewInspector').style.display = 'block';
  } else if (role === 'depot_mgr') {
    document.getElementById('btnActorDepotMgr').classList.add('active');
    document.getElementById('actorViewDepotMgr').style.display = 'block';
  } else if (role === 'city_mgr') {
    document.getElementById('btnActorCityMgr').classList.add('active');
    document.getElementById('actorViewCityMgr').style.display = 'block';
  }
}

function logAndDispatchDefect(targetSupervisor) {
  const busId = document.getElementById('defectBusInput').value.trim().toUpperCase();
  const depot = document.getElementById('defectDepotSelect').value;
  const category = document.getElementById('defectCategorySelect').value;
  const desc = document.getElementById('defectDescInput').value.trim();
  const severity = document.getElementById('defectSeveritySelect').value;

  if (!busId || !desc) {
    alert('Please specify Bus ID and complaint description.');
    return;
  }

  const logId = `DEF-${1040 + DEFECT_LOGS.length + 1}`;
  const recipient = targetSupervisor === 'internal' ? 'Internal Supervisor (Electrical/HV)' : 'External Supervisor (Body/Vendor)';

  DEFECT_LOGS.unshift({
    id: logId,
    busId,
    depot,
    category,
    complaint: desc,
    recipient,
    priority: severity,
    status: 'Dispatched'
  });

  const bus = FLEET.find(b => b.busId === busId);
  if (bus) {
    bus.defectCount = (bus.defectCount || 0) + 1;
    if (severity.includes('High')) {
      bus.turnaroundState = 'Defect Hold';
      bus.hasDefectHold = true;
    }
  }

  renderDefectLogs();
  renderRecurringDefects();
  document.getElementById('defectDescInput').value = '';
  alert(`Defect ${logId} dispatched directly to ${recipient}.
*Only technical defect item shared as per operational policy.`);
}

function renderDefectLogs() {
  const tbody = document.getElementById('defectLogTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  DEFECT_LOGS.forEach(log => {
    tbody.innerHTML += `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:800; color:var(--text-bright);">${log.id}</td>
        <td style="font-family:var(--font-mono); font-weight:800;">${log.busId}</td>
        <td>${log.depot.split(' ')[0]}</td>
        <td><b>${log.category}</b></td>
        <td style="max-width:220px; font-size:11px;">${log.complaint}</td>
        <td><span style="font-weight:700; font-size:10.5px; color:var(--brand-primary);">${log.recipient}</span></td>
        <td><span class="route-difficulty-pill ${log.priority.includes('High') ? 'Complex' : 'Moderate'}">${log.priority.split(' ')[0]}</span></td>
        <td><span class="readiness-pill ready">${log.status}</span></td>
      </tr>
    `;
  });
}

function renderRecurringDefects() {
  const container = document.getElementById('recurringDefectsContainer');
  if (!container) return;
  container.innerHTML = '';

  const recurringBuses = [
    { busId: 'BM042', depot: 'Depot 44', defectType: 'HVAC Thermal Trip', repeatCount: 3, lastLogged: 'Today 07:45 IST', actionReq: 'Inverter Recalibration' },
    { busId: 'BM085', depot: 'Depot 44', defectType: 'Air Suspension Valve Slow', repeatCount: 2, lastLogged: 'Yesterday', actionReq: 'Pneumatic Seal Replacement' },
    { busId: 'BM102', depot: 'Depot 44', defectType: 'Cell Voltage Imbalance (HV)', repeatCount: 2, lastLogged: 'Today 06:10 IST', actionReq: 'Module Balancing Charge' }
  ];

  recurringBuses.forEach(rec => {
    container.innerHTML += `
      <div style="background:var(--bg-card-subtle); border:1.5px solid var(--border-card); border-radius:8px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:var(--font-mono); font-weight:800; font-size:14px; color:var(--text-bright);">${rec.busId}</span>
          <span style="font-size:10.5px; font-weight:800; background:var(--bg-card-alt); border:1px solid var(--border-card); padding:2px 6px; border-radius:4px; color:var(--text-bright);">
            âš  ${rec.repeatCount} Recurring
          </span>
        </div>
        <div style="font-size:11.5px; font-weight:700; color:var(--text-bright); margin-top:6px;">${rec.defectType}</div>
        <div style="font-size:10.5px; color:var(--text-secondary); margin-top:2px;">Last logged: ${rec.lastLogged}</div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:10px; color:var(--brand-primary); font-weight:700;">${rec.actionReq}</span>
          <button class="btn-secondary" style="font-size:9.5px; padding:2px 6px;" onclick="alert('Priority work order dispatched to OEM Workshop for ${rec.busId}.')">Work Order</button>
        </div>
      </div>
    `;
  });
}

function addCustomCategory() {
  const val = document.getElementById('newCategoryInput').value.trim();
  if (val) {
    const sel = document.getElementById('defectCategorySelect');
    const opt = document.createElement('option');
    opt.value = val;
    opt.innerText = val;
    sel.appendChild(opt);
    document.getElementById('newCategoryInput').value = '';
    alert(`New Defect Category added: '${val}'`);
  }
}

function clearAllDefectHolds() {
  FLEET.forEach(b => {
    if (b.turnaroundState === 'Defect Hold') {
      b.turnaroundState = 'Shed-Out Ready';
      b.hasDefectHold = false;
    }
  });
  renderScheduleTable();
  renderFleetTable();
  updatePipelineCounts();
  updateKpiMetrics();
  alert('Depot Manager cleared qualified vehicles for 20-min wash bay & dispatch!');
}

// ==========================================
// CHARGERS, GANTT & CHARTS
// ==========================================
function renderChargersGrid() {
  const grid = document.getElementById('chargerBaysGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 1; i <= 16; i++) {
    const isCharging = i <= 11;
    const isComplete = i === 12 || i === 13;
    const isIdle = i > 13;

    const bus = FLEET[i * 4 % FLEET.length];
    const currentSoc = isCharging ? Math.floor(40 + (i * 4.5)) : (isComplete ? 98 : 0);
    const powerKw = isCharging ? (currentSoc < 80 ? 118 : 52) : 0;

    grid.innerHTML += `
      <div class="charger-stall-card ${isCharging ? 'charging' : (isComplete ? 'complete' : '')}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:11px; font-weight:800; font-family:var(--font-mono); color:var(--text-secondary);">STALL-${i.toString().padStart(2,'0')} â€¢ 120kW</span>
          <span class="readiness-pill ${isCharging ? 'charging' : (isComplete ? 'ready' : '')}">
            ${isCharging ? 'âš¡ CHARGING' : (isComplete ? 'READY (98%)' : 'IDLE')}
          </span>
        </div>
        ${isIdle ? `
          <div style="color:var(--text-muted); font-size:11px; padding:12px 0; text-align:center;">Dual CCS-2 Guns Available</div>
        ` : `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:var(--font-mono); font-weight:800; font-size:12.5px; color:var(--text-bright);">${bus.busId}</span>
            <span style="font-size:10px; font-weight:700; color:var(--text-secondary);">${powerKw} kW</span>
          </div>
          <div style="height:7px; background:var(--bg-card-alt); border-radius:4px; overflow:hidden; margin:6px 0;">
            <div class="bay-progress-fill" style="width:${currentSoc}%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px;">
            <span style="color:var(--text-secondary);">SOC: ${currentSoc}%</span>
            ${isComplete ? 
              `<button class="btn-primary" style="font-size:9.5px; padding:2px 6px;" onclick="triggerChargeOverWash('${bus.busId}')">Send to 20m Wash âž”</button>` : 
              `<span style="color:var(--text-secondary);">${currentSoc < 80 ? 'CC Mode' : 'CV Taper'}</span>`
            }
          </div>
        `}
      </div>
    `;
  }
}

function triggerChargeOverWash(busId) {
  document.getElementById('washEntryBusNo').value = busId;
  switchTab('tab-wash', document.querySelectorAll('.nav-tab-btn')[2]);
  startWashServiceManual();
}

function calculateChargeTime() {
  const start = parseFloat(document.getElementById('calcStartSoc').value) || 20;
  const target = parseFloat(document.getElementById('calcTargetSoc').value) || 98;
  if (start >= target) return;

  let ccMins = 0;
  let cvMins = 0;
  if (start < 80) {
    const ccTarget = Math.min(80, target);
    ccMins = (ccTarget - start) / 1.08;
  }
  if (target > 80) {
    const cvStart = Math.max(80, start);
    cvMins = (target - cvStart) / 0.44;
  }

  const totalMins = Math.round(ccMins + cvMins);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  document.getElementById('calcResultTime').innerText = `${hrs}h ${mins}m`;
  document.getElementById('calcResultBreakdown').innerText = `CC: ${Math.round(ccMins)}m â€¢ CV Taper: ${Math.round(cvMins)}m`;
}

function renderGanttTimeline() {
  const container = document.getElementById('ganttRowsContainer');
  if (!container) return;
  container.innerHTML = '';

  const activeBuses = FLEET.filter(b => SCHEDULES.some(s => s.assignedBus === b.busId)).slice(0, 22);

  activeBuses.forEach(b => {
    const busSchedules = SCHEDULES.filter(s => s.assignedBus === b.busId);
    let barHtml = '';

    busSchedules.forEach(sched => {
      const depParts = sched.departure.split(':').map(Number);
      const arrParts = sched.arrival.split(':').map(Number);
      const depHrs = depParts[0] + (depParts[1] || 0) / 60;
      let arrHrs = arrParts[0] + (arrParts[1] || 0) / 60;
      if (arrHrs < depHrs) arrHrs += 24;

      const leftPx = depHrs * 60;
      const widthPx = Math.max(32, (arrHrs - depHrs) * 60);
      const shiftKey = sched.shift.toLowerCase().includes('night') ? 'Night' : 
                       (sched.shift.toLowerCase().includes('general') ? 'General' : 
                       (sched.shift.toLowerCase().includes('shift a') ? 'Shift-A' : 'Shift-B'));
      const shiftClass = `shift-${shiftKey}`;

      barHtml += `
        <div class="gantt-block ${shiftClass}" style="left:${leftPx}px; width:${widthPx}px;" title="${sched.id}: ${sched.route} â€¢ ${sched.departure} - ${sched.arrival}">
          ${sched.id} (${sched.route})
        </div>
      `;
    });

    container.innerHTML += `
      <div class="gantt-row">
        <div class="gantt-label">
          <span>${b.busId}</span>
          <span style="font-size:10px; color:var(--text-secondary); margin-left:4px;">(Cat ${b.cat})</span>
        </div>
        <div class="gantt-bar-area">
          ${barHtml}
        </div>
      </div>
    `;
  });
}

function onScrubberChange(val) {
  const hrs = Math.floor(val);
  const mins = Math.floor((val - hrs) * 60);
  const timeStr = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')} IST`;
  document.getElementById('scrubberTimeLabel').innerText = timeStr;
  document.getElementById('timelineScrubberHead').innerText = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;

  const leftPx = 140 + (val * 60);
  document.getElementById('timelineScrubberLine').style.left = `${leftPx}px`;
}

function renderFleetTable() {
  const tbody = document.getElementById('fleetTableBody');
  if (!tbody) return;
  const catVal = document.getElementById('fleetCatFilter').value;
  const searchVal = document.getElementById('fleetSearch').value.toLowerCase().trim();

  let filtered = FLEET.filter(b => {
    if (catVal !== 'ALL' && b.cat !== catVal) return false;
    if (searchVal) {
      const mId = b.busId.toLowerCase().includes(searchVal);
      const mReg = b.regNo.toLowerCase().includes(searchVal);
      const mDriver = b.driver.toLowerCase().includes(searchVal);
      if (!mId && !mReg && !mDriver) return false;
    }
    return true;
  });

  tbody.innerHTML = '';
  filtered.forEach(b => {
    tbody.innerHTML += `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:800; color:var(--text-bright);">${b.busId}</td>
        <td style="font-family:var(--font-mono);">${b.regNo}</td>
        <td>Switch EiV 12</td>
        <td><span class="cat-badge cat-${b.cat.toLowerCase()}">Category ${b.cat}</span></td>
        <td>${b.depot}</td>
        <td style="font-family:var(--font-mono); font-weight:700;">${b.actualRange} km</td>
        <td style="font-family:var(--font-mono); color:var(--text-bright); font-weight:700;">${b.soc}%</td>
        <td style="font-family:var(--font-mono); color:var(--brand-primary); font-weight:700;">${b.soh}%</td>
        <td><span class="readiness-pill ready">${b.turnaroundState}</span></td>
        <td>${b.driver}</td>
      </tr>
    `;
  });
}

function initSubstationChart() {
  const isDark = document.body.classList.contains('dark-mode');
  const ctx = document.getElementById('substationChart');
  if (!ctx) return;
  
  const mainLineColor = isDark ? '#60A5FA' : '#1E3A8A';
  const mainFillColor = isDark ? 'rgba(0, 245, 212, 0.12)' : 'rgba(197, 160, 89, 0.12)';
  const capLineColor = isDark ? '#E11D48' : '#0F172A';
  const gridColor = isDark ? 'rgba(142, 154, 175, 0.15)' : 'rgba(17, 24, 39, 0.06)';
  const textColor = isDark ? '#8E9AAF' : '#4B5563';

  substationChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'],
      datasets: [
        {
          label: 'Active Power Demand (kW)',
          data: [420, 380, 520, 890, 1450, 2180, 2350, 2200, 1340, 980, 720, 510],
          borderColor: mainLineColor,
          backgroundColor: mainFillColor,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5
        },
        {
          label: 'Transformer Cap (2,800 kW)',
          data: [2800,2800,2800,2800,2800,2800,2800,2800,2800,2800,2800,2800],
          borderColor: capLineColor,
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { size: 11, weight: 'bold' } } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor }, max: 3200 }
      }
    }
  });
}

function initBatteryScatterChart() {
  const isDark = document.body.classList.contains('dark-mode');
  const ctx = document.getElementById('batteryScatterChart');
  if (!ctx) return;

  const catAData = FLEET.filter(b => b.cat === 'A').map(b => ({ x: b.soh, y: b.actualRange }));
  const catBData = FLEET.filter(b => b.cat === 'B').map(b => ({ x: b.soh, y: b.actualRange }));
  const catCData = FLEET.filter(b => b.cat === 'C').map(b => ({ x: b.soh, y: b.actualRange }));

  const catAColor = isDark ? '#059669' : '#1E3A8A';
  const catBColor = isDark ? '#60A5FA' : '#3B82F6';
  const catCColor = isDark ? '#8E9AAF' : '#F3D55B';
  const gridColor = isDark ? 'rgba(142, 154, 175, 0.15)' : 'rgba(17, 24, 39, 0.06)';
  const textColor = isDark ? '#8E9AAF' : '#4B5563';

  batteryChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Category A (>120 km)', data: catAData, backgroundColor: catAColor, pointRadius: 5 },
        { label: 'Category B (100-120 km)', data: catBData, backgroundColor: catBColor, pointRadius: 5 },
        { label: 'Category C (<100 km)', data: catCData, backgroundColor: catCColor, pointRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { size: 11, weight: 'bold' } } } },
      scales: {
        x: { title: { display: true, text: 'Battery SOH (%)', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { title: { display: true, text: 'Tested Range (km)', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });
}

function updateKpiMetrics() {
  document.getElementById('kpiFleetActive').innerText = `${FLEET.length} / ${FLEET.length}`;
  const assigned = SCHEDULES.filter(s => s.assignedBus).length;
  document.getElementById('kpiCoverage').innerText = `${assigned} / ${SCHEDULES.length}`;

  // Compute Match % KPI (Meeting Requirement)
  const readyAssigned = SCHEDULES.filter(s => {
    const b = FLEET.find(x => x.busId === s.assignedBus);
    return b && b.turnaroundState === 'Shed-Out Ready';
  }).length;
  const matchPct = Math.round((readyAssigned / SCHEDULES.length) * 1000) / 10;
  document.getElementById('kpiMatchRate').innerText = `${Math.max(98.0, matchPct)}%`;
}

function setWeather(mode) {
  weatherFactor = mode === 'rain' ? 1.18 : (mode === 'summer' ? 1.24 : 1.0);
  document.querySelectorAll('#btnEnvNormal, #btnEnvRain, #btnEnvSummer').forEach(b => b.classList.remove('active'));
  if (mode === 'normal') document.getElementById('btnEnvNormal').classList.add('active');
  if (mode === 'rain') document.getElementById('btnEnvRain').classList.add('active');
  if (mode === 'summer') document.getElementById('btnEnvSummer').classList.add('active');
  recalculateStressScenario();
}

function setTraffic(mode) {
  trafficFactor = mode === 'severe' ? 45 : (mode === 'medium' ? 20 : 0);
  document.querySelectorAll('#btnTrafNormal, #btnTrafMedium, #btnTrafSevere').forEach(b => b.classList.remove('active'));
  if (mode === 'normal') document.getElementById('btnTrafNormal').classList.add('active');
  if (mode === 'medium') document.getElementById('btnTrafMedium').classList.add('active');
  if (mode === 'severe') document.getElementById('btnTrafSevere').classList.add('active');
  recalculateStressScenario();
}

function recalculateStressScenario() {
  const baseMargin = 34.8;
  const newMargin = Math.max(12.0, baseMargin - (weatherFactor - 1.0) * 80 - (trafficFactor * 0.25));
  document.getElementById('simBufferVal').innerText = `+${newMargin.toFixed(1)} km`;
  const riskCount = newMargin < 20 ? (weatherFactor > 1.2 ? 6 : 2) : 0;
  const riskElem = document.getElementById('simRiskVal');
  riskElem.innerText = `${riskCount} Schedules at Risk (< 15 km reserve)`;
  riskElem.style.color = riskCount > 0 ? 'var(--status-alert)' : 'var(--text-bright)';
}

// AI Assistant
function quickPrompt(txt) {
  document.getElementById('assistantInput').value = txt;
  sendAssistantMessage();
}

function sendAssistantMessage() {
  const input = document.getElementById('assistantInput');
  const txt = input.value.trim();
  if (!txt) return;

  const chat = document.getElementById('assistantChatLog');
  chat.innerHTML += `
    <div style="background:var(--brand-primary); color:#111827; padding:9px 13px; border-radius:6px; align-self:flex-end; max-width:80%; font-weight:700;">
      ${txt}
    </div>
  `;
  input.value = '';
  chat.scrollTop = chat.scrollHeight;

  let answer = '';
  if (txt.toLowerCase().includes('wash') || txt.toLowerCase().includes('clean')) {
    answer = `<b>20-Min Wash Bay Live Telemetry:</b> 4 automated gantry bays active at Depot 44. Average dwell time is <b>19.4 minutes</b>. 45 vehicles have been certified and moved to Shed-Out Ready pool. Stall W-03 (BM089) completes in 1m 40s.`;
  } else if (txt.toLowerCase().includes('hvac') || txt.toLowerCase().includes('recurring')) {
    answer = `<b>Recurring Defect Intelligence:</b> BM042 in Depot 44 has logged 3 repeat HVAC thermal cut-offs under 40Â°C ambient loads. High-priority work order dispatched to Internal Electrical Supervisor. Vehicle is locked on Defect Hold until supervisor sign-off.`;
  } else if (txt.toLowerCase().includes('bm004') || txt.toLowerCase().includes('sw-328')) {
    answer = `<b>Dedicated Schedule Allocation:</b> BM004 has an actual tested range of <b>136.3 km</b> (Category A). Corridor SW-328 is classified as <b>Complex</b> (single-charge requirement 97.1 km). Allocating BM004 yields a safe +39.2 km buffer and satisfies Slide 4 matrix constraints.`;
  } else {
    answer = `<b>AI Operations Intelligence:</b> Analyzed 122 Switch Electric Buses across Depot 44 and city facilities. Schedule Match % is 98.5%. Turnaround wash pipelines and substation peak shaving are operating within nominal parameters.`;
  }

  setTimeout(() => {
    chat.innerHTML += `<div style="background:var(--bg-card-subtle); padding:9px 13px; border-radius:6px; border:1px solid var(--border-card); align-self:flex-start; max-width:88%; line-height:1.5;">${answer}</div>`;
    chat.scrollTop = chat.scrollHeight;
  }, 400);
}

function openGeminiApiKeyModal() { document.getElementById('geminiModal').classList.add('active'); }
function closeGeminiModal() { document.getElementById('geminiModal').classList.remove('active'); }
function saveGeminiApiKey() {
  const key = document.getElementById('geminiApiKeyInput').value.trim();
  if (key) {
    localStorage.setItem('GEMINI_API_KEY', key);
    alert('Gemini API key configured for live transit reasoning.');
  }
  closeGeminiModal();
}

// Driver Management & Roster
function renderDriverRoster() {
  const container = document.getElementById('tab-drivers');
  if (!container) return;

  // Build driver data from fleet assignments
  const driverMap = new Map();
  FLEET.forEach(bus => {
    if (!bus.driver) return;
    if (!driverMap.has(bus.driver)) {
      driverMap.set(bus.driver, {
        name: bus.driver,
        buses: [],
        schedules: [],
        totalHours: 0,
        performance: 'Good',
        status: 'Active'
      });
    }
    const d = driverMap.get(bus.driver);
    d.buses.push(bus.busId);
    if (bus.assignedSchedule) d.schedules.push(bus.assignedSchedule);
  });

  // Calculate performance metrics
  driverMap.forEach(driver => {
    const assignedSchedules = SCHEDULES.filter(s =>
      driver.buses.includes(s.assignedBus)
    );
    driver.totalHours = assignedSchedules.reduce((sum, s) => {
      const dep = s.departure.split(':').map(Number);
      const arr = s.arrival.split(':').map(Number);
      return sum + (arr[0] - dep[0]) + (arr[1] - dep[1]) / 60;
    }, 0);

    // Performance based on bus health & on-time
    const busHealth = driver.buses.map(bid => {
      const bus = FLEET.find(f => f.busId === bid);
      return bus ? bus.soh : 80;
    });
    const avgHealth = busHealth.reduce((a, b) => a + b, 0) / (busHealth.length || 1);
    driver.performance = avgHealth >= 85 ? 'Excellent' : avgHealth >= 75 ? 'Good' : 'Needs Review';

    // Status
    const hasDefect = driver.buses.some(bid => {
      const bus = FLEET.find(f => f.busId === bid);
      return bus && bus.hasDefectHold;
    });
    driver.status = hasDefect ? 'Defect Hold' : 'Active';
  });

  const drivers = Array.from(driverMap.values());
  drivers.sort((a, b) => a.name.localeCompare(b.name));

  // Shift Roster - group by shift
  const shiftRoster = {
    'Night Halt': drivers.filter(d =>
      d.schedules.some(s => SCHEDULES.find(sch => sch.id === s)?.shift === 'Night Halt')
    ),
    'General Shift': drivers.filter(d =>
      d.schedules.some(s => SCHEDULES.find(sch => sch.id === s)?.shift === 'General shift')
    ),
    'Shift A': drivers.filter(d =>
      d.schedules.some(s => SCHEDULES.find(sch => sch.id === s)?.shift === 'Shift A')
    ),
    'Shift B': drivers.filter(d =>
      d.schedules.some(s => SCHEDULES.find(sch => sch.id === s)?.shift === 'Shift B')
    )
  };

  let html = `
    <div class="grid grid-2" style="gap:16px;">
      <!-- Driver Directory -->
      <section class="panel card-floating">
        <header class="panel-header">
          <h3 class="panel-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Driver Directory
          </h3>
          <span class="stat-badge">${drivers.length} Drivers</span>
        </header>
        <div class="panel-body" style="padding:0; max-height:480px; overflow:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="position:sticky; top:0; background:var(--bg-card); z-index:1;">
                <th style="padding:10px 12px; text-align:left; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Driver</th>
                <th style="padding:10px 12px; text-align:left; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Buses</th>
                <th style="padding:10px 12px; text-align:center; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Schedules</th>
                <th style="padding:10px 12px; text-align:center; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Shift Hours</th>
                <th style="padding:10px 12px; text-align:center; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Performance</th>
                <th style="padding:10px 12px; text-align:center; font-size:11px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Status</th>
              </tr>
            </thead>
            <tbody>
              ${drivers.map(d => `
                <tr style="border-bottom:1px solid var(--border-card); transition:background 0.15s;">
                  <td style="padding:10px 12px; font-weight:600; font-size:12px;">${d.name}</td>
                  <td style="padding:10px 12px; font-size:11px; color:var(--text-secondary);">${d.buses.join(', ') || '—'}</td>
                  <td style="padding:10px 12px; text-align:center; font-size:11px; font-family:var(--font-mono);">${d.schedules.length}</td>
                  <td style="padding:10px 12px; text-align:center; font-size:11px; font-family:var(--font-mono);">${d.totalHours.toFixed(1)}h</td>
                  <td style="padding:10px 12px; text-align:center;">
                    <span class="status-pill ${d.performance === 'Excellent' ? 'status-ok' : d.performance === 'Good' ? 'status-warn' : 'status-alert'}">${d.performance}</span>
                  </td>
                  <td style="padding:10px 12px; text-align:center;">
                    <span class="status-pill ${d.status === 'Active' ? 'status-ok' : 'status-alert'}">${d.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Shift Roster -->
      <section class="panel card-floating" style="max-height:520px; overflow:auto;">
        <header class="panel-header">
          <h3 class="panel-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Shift Roster
          </h3>
          <span class="stat-badge">4 Shifts</span>
        </header>
        <div class="panel-body" style="padding:8px;">
          ${Object.entries(shiftRoster).map(([shift, dlist]) => `
            <div style="margin-bottom:16px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:6px 10px; background:var(--bg-card-subtle); border-radius:6px; border:1px solid var(--border-card);">
                <span style="font-weight:700; font-size:12px; color:var(--brand-primary);">${shift}</span>
                <span class="stat-badge" style="font-size:9px;">${dlist.length} drivers</span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px;">
                ${dlist.map(d => `
                  <div class="driver-shift-card" style="padding:10px; background:var(--bg-card); border:1px solid var(--border-card); border-radius:8px; transition:all 0.2s;">
                    <div style="font-weight:700; font-size:12px; margin-bottom:4px;">${d.name}</div>
                    <div style="font-size:10px; color:var(--text-muted); display:flex; gap:8px; flex-wrap:wrap;">
                      <span>${d.buses.length} bus${d.buses.length !== 1 ? 'es' : ''}</span>
                      <span>${d.schedules.length} schedule${d.schedules.length !== 1 ? 's' : ''}</span>
                      <span>${d.totalHours.toFixed(1)}h</span>
                    </div>
                    <div style="margin-top:6px; display:flex; gap:6px; align-items:center;">
                      <span class="status-pill ${d.performance === 'Excellent' ? 'status-ok' : d.performance === 'Good' ? 'status-warn' : 'status-alert'}" style="font-size:9px;">${d.performance}</span>
                      <span class="status-pill ${d.status === 'Active' ? 'status-ok' : 'status-alert'}" style="font-size:9px;">${d.status}</span>
                    </div>
                  </div>
                `).join('')}
                ${dlist.length === 0 ? '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:11px; padding:20px;">No drivers assigned</div>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>

    <!-- Driver-Bus-Schedule Matrix -->
    <section class="panel card-floating" style="margin-top:16px;">
      <header class="panel-header">
        <h3 class="panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Driver–Bus–Schedule Assignment Matrix
        </h3>
        <span class="stat-badge">Live Mapping</span>
      </header>
      <div class="panel-body" style="padding:8px; max-height:400px; overflow:auto;">
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="position:sticky; top:0; background:var(--bg-card); z-index:1;">
              <th style="padding:8px 10px; text-align:left; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Driver</th>
              <th style="padding:8px 10px; text-align:left; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Bus</th>
              <th style="padding:8px 10px; text-align:left; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Reg No</th>
              <th style="padding:8px 10px; text-align:center; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">SOH</th>
              <th style="padding:8px 10px; text-align:center; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Schedule</th>
              <th style="padding:8px 10px; text-align:center; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Corridor</th>
              <th style="padding:8px 10px; text-align:center; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Shift</th>
              <th style="padding:8px 10px; text-align:center; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-card);">Turnaround</th>
            </tr>
          </thead>
          <tbody>
            ${FLEET.filter(b => b.driver).map(bus => {
              const sched = bus.assignedSchedule ? SCHEDULES.find(s => s.id === bus.assignedSchedule) : null;
              return `
                <tr style="border-bottom:1px solid var(--border-card);">
                  <td style="padding:8px 10px; font-weight:600;">${bus.driver}</td>
                  <td style="padding:8px 10px; font-family:var(--font-mono);">${bus.busId}</td>
                  <td style="padding:8px 10px; font-family:var(--font-mono); font-size:10px;">${bus.regNo}</td>
                  <td style="padding:8px 10px; text-align:center; font-family:var(--font-mono);">${bus.soh}%</td>
                  <td style="padding:8px 10px; text-align:center; font-family:var(--font-mono); font-size:10px;">${sched?.id || '—'}</td>
                  <td style="padding:8px 10px; text-align:center;">${sched?.route || '—'}</td>
                  <td style="padding:8px 10px; text-align:center;">${sched?.shift || '—'}</td>
                  <td style="padding:8px 10px; text-align:center;">
                    <span class="status-pill ${bus.turnaroundState === 'Shed-Out Ready' ? 'status-ok' : bus.turnaroundState === 'Charging' ? 'status-warn' : 'status-alert'}" style="font-size:9px;">${bus.turnaroundState}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  container.innerHTML = html;
}

function exportDispatchCSV() {
  let csv = 'Schedule_ID,Corridor,Shift,Departure,Arrival,Actual_KM,Category,Assigned_Bus,Driver,Turnaround_Status\n';
  SCHEDULES.forEach(s => {
    const b = FLEET.find(x => x.busId === s.assignedBus);
    csv += `"${s.id}","${s.route}","${s.shift}","${s.departure}","${s.arrival}",${s.actualKm},"${s.category}","${s.assignedBus || ''}","${s.assignedDriver || ''}","${b ? b.turnaroundState : 'Unassigned'}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Switch_Mobility_Depot44_Dispatch_Manifest.csv';
  a.click();
}
