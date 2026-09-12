import { citizenSafetyApi, type EmergencyRecord } from './api/citizen-safety.api';

type IncidentFilter = 'all' | 'new' | 'assigned' | 'en_route' | 'resolved' | 'live' | 'demo';
type StaticView = 'dashboard' | 'incidents' | 'chat' | 'reports' | 'settings';

type DistrictModel = {
  name: string;
  score: number;
  incidents: number;
  band: 'critical' | 'high' | 'moderate' | 'low';
};

let latestRecords: EmergencyRecord[] = [];
let loading = false;
let pollTimer: number | null = null;
let renderTimer: number | null = null;
let activeFilter: IncidentFilter = 'all';
let currentStaticView: StaticView | null = null;

function activeRecords() {
  return latestRecords.filter((record) => record.status !== 'cancelled' && record.status !== 'resolved');
}

function riskBand(record: EmergencyRecord) {
  const score = Number(record.risk_score ?? 0);
  const level = String(record.risk_level ?? '').toLowerCase();
  if (level === 'critical' || score >= 80) return 'critical';
  if (level === 'high' || score >= 60) return 'high';
  if (level === 'moderate' || score >= 35) return 'moderate';
  return 'low';
}

function priorityScore(record: EmergencyRecord) {
  let score = record.emergency_type === 'medical' ? 36 : record.emergency_type === 'rescue' ? 30 : 18;
  score += Math.min(35, Math.max(0, Number(record.risk_score ?? 0)) * 0.35);
  score += Math.min(18, Math.max(1, Number(record.people_count ?? 1)) * 3);
  const ageMinutes = Math.max(0, (Date.now() - Date.parse(record.created_at)) / 60000);
  score += Math.min(18, ageMinutes * 0.6);
  if (record.status === 'submitted') score += 20;
  else if (record.status === 'assigned') score += 10;
  else if (record.status === 'en_route') score += 5;
  else if (record.status === 'resolved') score -= 40;
  if (record.is_demo) score -= 5;
  return Math.max(0, Math.round(score));
}

function priorityBand(record: EmergencyRecord) {
  const score = priorityScore(record);
  if (score >= 80) return { label: 'CRITICAL', cls: 'critical' };
  if (score >= 58) return { label: 'HIGH', cls: 'high' };
  if (score >= 35) return { label: 'MEDIUM', cls: 'medium' };
  return { label: 'LOW', cls: 'low' };
}

function selectedRecord() {
  const id = document.querySelector<HTMLElement>('.ops-id-row > span')?.textContent?.trim();
  return latestRecords.find((record) => record.id === id) ?? null;
}

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : '—';
}

function relabelWorkerShell() {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  const subtitle = shell.querySelector<HTMLElement>('.ops-logo-row span');
  if (subtitle) subtitle.textContent = 'Emergency Response';
  const role = shell.querySelector<HTMLElement>('.ops-role');
  if (role) role.textContent = 'ADMIN';
  const userRole = shell.querySelector<HTMLElement>('.ops-user small');
  if (userRole) userRole.textContent = 'Admin / Coordinator';

  shell.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    const span = button.querySelector('span');
    if (!span) return;
    if (span.textContent?.trim() === 'Command Center') span.textContent = 'Dashboard';
    if (span.textContent?.trim() === 'Emergency Queue') span.textContent = 'Incident Queue';
  });
}

function matchesFilter(record: EmergencyRecord, filter: IncidentFilter) {
  if (filter === 'all') return true;
  if (filter === 'new') return record.status === 'submitted';
  if (filter === 'assigned') return record.status === 'assigned';
  if (filter === 'en_route') return record.status === 'en_route';
  if (filter === 'resolved') return record.status === 'resolved';
  if (filter === 'live') return !record.is_demo;
  return Boolean(record.is_demo);
}

function renderFilters() {
  const pane = document.querySelector<HTMLElement>('.ops-queue-pane');
  if (!pane) return;
  let filters = pane.querySelector<HTMLElement>('[data-command-center-filters]');
  if (!filters) {
    filters = document.createElement('div');
    filters.dataset.commandCenterFilters = 'true';
    filters.className = 'command-center-filters';
    pane.querySelector('header')?.insertAdjacentElement('afterend', filters);
  }
  const defs: Array<[IncidentFilter, string]> = [
    ['all', 'All'], ['new', 'New'], ['assigned', 'Assigned'], ['en_route', 'En Route'], ['resolved', 'Resolved'], ['live', 'Live only'], ['demo', 'Demo'],
  ];
  filters.innerHTML = defs.map(([key, label]) => {
    const count = latestRecords.filter((record) => matchesFilter(record, key)).length;
    return `<button type="button" data-incident-filter="${key}" class="${activeFilter === key ? 'active' : ''}"><span>${label}</span><b>${count}</b></button>`;
  }).join('');
  filters.querySelectorAll<HTMLButtonElement>('[data-incident-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = (button.dataset.incidentFilter as IncidentFilter) || 'all';
      renderFilters();
      applyQueueSortingAndFilter();
    });
  });
}

function applyQueueSortingAndFilter() {
  const list = document.querySelector<HTMLElement>('.ops-queue-list');
  if (!list) return;
  const cards = Array.from(list.querySelectorAll<HTMLButtonElement>(':scope > button'));
  const byId = new Map(latestRecords.map((record) => [record.id, record]));
  const ranked = cards.map((card) => {
    const id = card.querySelector<HTMLElement>('.queue-top > span')?.textContent?.trim() ?? '';
    return { card, record: byId.get(id) };
  }).filter((entry): entry is { card: HTMLButtonElement; record: EmergencyRecord } => Boolean(entry.record));

  ranked.sort((a, b) => priorityScore(b.record) - priorityScore(a.record));
  ranked.forEach(({ card, record }) => {
    const priority = priorityBand(record);
    let badge = card.querySelector<HTMLElement>('[data-incident-priority]');
    if (!badge) {
      badge = document.createElement('em');
      badge.dataset.incidentPriority = 'true';
      badge.className = 'command-center-priority';
      card.querySelector('.queue-top')?.appendChild(badge);
    }
    badge.className = `command-center-priority ${priority.cls}`;
    badge.textContent = `${priority.label} · ${priorityScore(record)}`;
    card.style.display = matchesFilter(record, activeFilter) ? '' : 'none';
    list.appendChild(card);
  });

  let empty = list.querySelector<HTMLElement>('[data-command-center-filter-empty]');
  const visibleCount = ranked.filter(({ record }) => matchesFilter(record, activeFilter)).length;
  if (!visibleCount && latestRecords.length) {
    if (!empty) {
      empty = document.createElement('div');
      empty.dataset.commandCenterFilterEmpty = 'true';
      empty.className = 'command-center-filter-empty';
      list.appendChild(empty);
    }
    empty.textContent = 'No incidents match this filter.';
  } else empty?.remove();
}

function districtModels(): DistrictModel[] {
  const active = activeRecords();
  const liveCount = active.filter((r) => !r.is_demo).length;
  const highCount = active.filter((r) => ['critical', 'high'].includes(riskBand(r))).length;
  const rescueCount = active.filter((r) => r.emergency_type === 'rescue').length;
  const medicalCount = active.filter((r) => r.emergency_type === 'medical').length;
  const rows: DistrictModel[] = [
    { name: 'Sindhupalchok', score: Math.min(99, 82 + highCount * 3), incidents: Math.max(1, highCount + rescueCount), band: 'critical' },
    { name: 'Rautahat', score: Math.min(94, 72 + rescueCount * 2), incidents: Math.max(1, rescueCount), band: 'high' },
    { name: 'Chitwan', score: Math.min(89, 68 + medicalCount * 2), incidents: Math.max(1, medicalCount), band: 'high' },
    { name: 'Kathmandu', score: Math.min(78, 52 + liveCount * 2), incidents: Math.max(1, liveCount), band: 'moderate' },
  ];
  return rows.sort((a, b) => b.score - a.score);
}

function metricCard(label: string, value: string | number, note: string, cls = '', source = 'LIVE') {
  return `<article class="admin-metric ${cls}"><div><span>${label}</span><em>${source}</em></div><strong>${value}</strong><p>${note}</p></article>`;
}

function renderAdminDashboard() {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  currentStaticView = 'dashboard';
  shell.querySelector<HTMLElement>('.command-center-static-view')?.remove();
  shell.querySelectorAll<HTMLElement>('.ops-queue-pane,.ops-detail-pane,.ops-map-page').forEach((el) => { el.style.display = 'none'; });

  const active = activeRecords();
  const people = active.reduce((sum, r) => sum + Math.max(1, Number(r.people_count ?? 1)), 0);
  const responders = new Set(active.map((r) => r.responder_name).filter(Boolean)).size;
  const districts = districtModels();
  const criticalDistricts = districts.filter((d) => d.band === 'critical' || d.score >= 80).length;
  const totalCapacity = 420;
  const assignedCapacity = Math.min(totalCapacity, Math.max(people, active.length * 4));
  const capacityPct = Math.round((assignedCapacity / totalCapacity) * 100);
  const unresolvedLive = active.filter((r) => !r.is_demo).length;

  const view = document.createElement('section');
  view.className = 'command-center-static-view admin-dashboard-view';
  view.innerHTML = `
    <header class="admin-dashboard-header">
      <div><span class="admin-eyebrow">DASHBOARD</span><h1>National Operations Overview</h1><p>Nepal Flood Intelligence Network · backend emergency state + clearly labeled modeled district context</p></div>
      <div class="admin-view-switch"><button class="active" data-admin-view="global">GLOBAL VIEW</button><button data-admin-view="district">DISTRICT VIEW</button><span>● LIVE</span></div>
    </header>
    <div class="admin-metrics-grid">
      ${metricCard('CRITICAL DISTRICTS', criticalDistricts, 'Modeled district risk requiring attention', 'critical', 'HYBRID')}
      ${metricCard('ACTIVE INCIDENTS', active.length, `${unresolvedLive} live citizen SOS · ${active.length - unresolvedLive} demo`, 'warning')}
      ${metricCard('PEOPLE AT RISK', people, 'People represented by active incident records')}
      ${metricCard('ACTIVE RESPONDERS', responders, responders ? 'Assigned or en-route response units' : 'No active assignment in current backend')}
    </div>
    <div class="admin-dashboard-main">
      <article class="admin-risk-map-card">
        <div class="admin-card-heading"><div><span>NATIONAL RISK MAP</span><strong>Click a district to inspect modeled context</strong></div><div class="admin-risk-legend"><i class="low"></i>LOW<i class="moderate"></i>MODERATE<i class="high"></i>HIGH<i class="critical"></i>CRITICAL</div></div>
        <div class="admin-nepal-map" data-admin-national-map>
          <div class="admin-range-label">△ Himalayan Range</div>
          <button class="district-shape kathmandu" data-district="Kathmandu"><b>Kathmandu</b><small>${districts.find(d => d.name === 'Kathmandu')?.score ?? 0}</small></button>
          <button class="district-shape sindhupalchok" data-district="Sindhupalchok"><b>Sindhupalchok</b><small>${districts.find(d => d.name === 'Sindhupalchok')?.score ?? 0}</small></button>
          <button class="district-shape chitwan" data-district="Chitwan"><b>Chitwan</b><small>${districts.find(d => d.name === 'Chitwan')?.score ?? 0}</small></button>
          <button class="district-shape rautahat" data-district="Rautahat"><b>Rautahat</b><small>${districts.find(d => d.name === 'Rautahat')?.score ?? 0}</small></button>
          <div class="admin-terai-label">Terai Belt</div>
        </div>
        <div class="admin-map-detail" data-admin-district-detail>National view · ${active.length} active incidents from the backend. District colors are modeled/hybrid until district-level live feeds are connected.</div>
      </article>
      <aside class="admin-highest-risk">
        <span>HIGHEST RISK</span>
        ${districts.map((d, index) => `<button data-risk-district="${d.name}"><div><b>${index + 1}.</b><strong>${d.name}</strong><em class="${d.band}">${d.band.toUpperCase()}</em></div><p><strong>${d.score} / 100</strong><small>${d.incidents} modeled incident${d.incidents === 1 ? '' : 's'}</small></p><i><u style="width:${d.score}%"></u></i></button>`).join('')}
      </aside>
    </div>
    <div class="admin-dashboard-bottom">
      <article class="admin-trend-card"><div class="admin-card-heading"><div><span>NATIONAL RISK TREND</span><strong>Recent modeled risk evolution</strong></div><em>HYBRID</em></div><svg viewBox="0 0 520 150" aria-label="Modeled national risk trend"><path d="M20 120 C95 112,110 100,160 96 S260 76,310 80 S405 54,500 42" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 120 L160 96 L310 80 L500 42" fill="none" stroke="currentColor" stroke-width="1" opacity=".25" stroke-dasharray="4 6"/><circle cx="20" cy="120" r="4"/><circle cx="160" cy="96" r="4"/><circle cx="310" cy="80" r="4"/><circle cx="500" cy="42" r="4"/><text x="10" y="142">LOWER</text><text x="458" y="30">CURRENT</text></svg></article>
      <article class="admin-capacity-card"><div class="admin-card-heading"><div><span>SAFE-ZONE NETWORK</span><strong>National capacity summary</strong></div><em>HYBRID</em></div><div class="admin-capacity-grid"><div><span>Total Capacity</span><strong>${totalCapacity}</strong></div><div><span>Assigned Evacuees</span><strong>${assignedCapacity}</strong></div><div><span>Available</span><strong>${totalCapacity - assignedCapacity}</strong></div><div><span>Utilization</span><strong>${capacityPct}%</strong></div></div><div class="admin-capacity-bar"><i style="width:${capacityPct}%"></i></div><p>Capacity is modeled for the hackathon prototype; incident people counts come from the current emergency backend.</p></article>
    </div>`;

  shell.appendChild(view);
  markNavActive('Dashboard');
  wireDashboardInteractions(view, districts);
}

function wireDashboardInteractions(view: HTMLElement, districts: DistrictModel[]) {
  const detail = view.querySelector<HTMLElement>('[data-admin-district-detail]');
  const selectDistrict = (name: string) => {
    const district = districts.find((d) => d.name === name);
    if (!district || !detail) return;
    detail.innerHTML = `<strong>${district.name}</strong> · ${district.score}/100 modeled risk · ${district.incidents} modeled incident${district.incidents === 1 ? '' : 's'}. <span>Backend district feeds are not connected yet.</span>`;
    view.querySelectorAll<HTMLElement>('[data-district],[data-risk-district]').forEach((el) => el.classList.toggle('selected', el.getAttribute('data-district') === name || el.getAttribute('data-risk-district') === name));
  };
  view.querySelectorAll<HTMLButtonElement>('[data-district]').forEach((button) => button.addEventListener('click', () => selectDistrict(button.dataset.district || '')));
  view.querySelectorAll<HTMLButtonElement>('[data-risk-district]').forEach((button) => button.addEventListener('click', () => selectDistrict(button.dataset.riskDistrict || '')));
  view.querySelectorAll<HTMLButtonElement>('[data-admin-view]').forEach((button) => button.addEventListener('click', () => {
    view.querySelectorAll('[data-admin-view]').forEach((el) => el.classList.remove('active'));
    button.classList.add('active');
    if (button.dataset.adminView === 'district') selectDistrict(districts[0]?.name || 'Sindhupalchok');
    else if (detail) detail.textContent = `National view · ${activeRecords().length} active incidents from the backend. District colors are modeled/hybrid until district-level live feeds are connected.`;
  }));
}

function renderStaticView(kind: Exclude<StaticView, 'dashboard'>) {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  currentStaticView = kind;
  shell.querySelector<HTMLElement>('.command-center-static-view')?.remove();
  shell.querySelectorAll<HTMLElement>('.ops-queue-pane,.ops-detail-pane,.ops-map-page').forEach((el) => { el.style.display = 'none'; });
  const view = document.createElement('section');
  view.className = 'command-center-static-view';
  const active = activeRecords();
  if (kind === 'incidents') view.innerHTML = `<header><span>ALL INCIDENTS</span><h1>Incident registry</h1><p>Use the Incident Queue for live operational handling and filters.</p></header><button class="command-center-open-queue">Open Incident Queue</button>`;
  else if (kind === 'chat') view.innerHTML = `<header><span>NAVCAT · ADMIN</span><h1>Operational AI Assistant</h1><p>Admin NavCat will reuse the citizen engine with role-scoped operational tools.</p></header><div class="command-center-coming-soon">Next: summarize SOS, rank incidents, locate citizens, inspect hazards, and prepare responder routes.</div>`;
  else if (kind === 'reports') view.innerHTML = `<header><span>REPORTS</span><h1>Operational reporting</h1><p>Current backend snapshot.</p></header><div class="command-center-dashboard-metrics"><div><span>TOTAL</span><strong>${latestRecords.length}</strong></div><div><span>ACTIVE</span><strong>${active.length}</strong></div><div><span>RESOLVED</span><strong>${latestRecords.filter(r => r.status === 'resolved').length}</strong></div><div><span>LIVE SOURCE</span><strong>${latestRecords.filter(r => !r.is_demo).length}</strong></div></div>`;
  else view.innerHTML = `<header><span>SETTINGS</span><h1>Admin settings</h1><p>Role permissions, alert thresholds, integrations, and audit controls will be finalized during the security pass.</p></header>`;
  shell.appendChild(view);
  view.querySelector<HTMLButtonElement>('.command-center-open-queue')?.addEventListener('click', () => restoreQueue('all'));
  markNavActive(kind === 'incidents' ? 'All Incidents' : kind === 'chat' ? 'AI Assistant' : kind === 'reports' ? 'Reports' : 'Settings');
}

function restoreQueue(filter?: IncidentFilter) {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  currentStaticView = null;
  shell.querySelector<HTMLElement>('.command-center-static-view')?.remove();
  shell.querySelector<HTMLElement>('.ops-queue-pane')?.style.removeProperty('display');
  shell.querySelector<HTMLElement>('.ops-detail-pane')?.style.removeProperty('display');
  if (filter) activeFilter = filter;
  markNavActive('Incident Queue');
}

function markNavActive(label: string) {
  document.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    const text = button.querySelector('span')?.textContent?.trim();
    if (text === 'Live Map') return;
    button.classList.toggle('active', text === label);
  });
}

function wireNavigation() {
  document.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    const label = button.querySelector('span')?.textContent?.trim();
    if (!label || button.dataset.commandCenterWired === label) return;
    button.dataset.commandCenterWired = label;
    if (label === 'Dashboard') button.addEventListener('click', (event) => { event.preventDefault(); renderAdminDashboard(); });
    else if (label === 'All Incidents') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('incidents'); });
    else if (label === 'AI Assistant') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('chat'); });
    else if (label === 'Reports') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('reports'); });
    else if (label === 'Settings') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('settings'); });
    else if (label === 'Incident Queue') button.addEventListener('click', () => restoreQueue(activeFilter));
    else if (label === 'Live Map') button.addEventListener('click', () => { currentStaticView = null; document.querySelector<HTMLElement>('.command-center-static-view')?.remove(); });
  });
}

function renderSummary() {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  relabelWorkerShell();
  wireNavigation();

  if (currentStaticView === 'dashboard') renderAdminDashboard();

  const active = activeRecords();
  const live = active.filter((record) => !record.is_demo);
  const unassigned = live.filter((record) => record.status === 'submitted').length;
  const enRoute = live.filter((record) => record.status === 'en_route').length;
  const critical = live.filter((record) => ['critical', 'high'].includes(priorityBand(record).cls)).length;

  let summary = shell.querySelector<HTMLElement>('[data-command-center-summary]');
  if (!summary) {
    summary = document.createElement('section');
    summary.dataset.commandCenterSummary = 'true';
    summary.className = 'command-center-summary';
    const host = shell.querySelector<HTMLElement>('.ops-detail-pane, .ops-map-page');
    host?.prepend(summary);
  }
  if (summary) summary.innerHTML = `<div class="command-center-title"><span>OPERATIONS</span><strong>Live response overview</strong><small>Emergency backend · refreshes every 5 seconds</small></div><div class="command-center-metric"><span>ACTIVE LIVE</span><strong>${live.length}</strong></div><div class="command-center-metric urgent"><span>UNASSIGNED</span><strong>${unassigned}</strong></div><div class="command-center-metric"><span>EN ROUTE</span><strong>${enRoute}</strong></div><div class="command-center-metric critical"><span>HIGH PRIORITY</span><strong>${critical}</strong></div>`;

  const selected = selectedRecord();
  const detailPane = shell.querySelector<HTMLElement>('.ops-detail-pane');
  let context = detailPane?.querySelector<HTMLElement>('[data-command-center-context]') ?? null;
  if (!selected) { context?.remove(); return; }
  if (!context) {
    context = document.createElement('section');
    context.dataset.commandCenterContext = 'true';
    context.className = 'command-center-context';
    detailPane?.querySelector('.ops-detail-header')?.insertAdjacentElement('afterend', context);
  }
  if (!context) return;
  const risk = riskBand(selected);
  const source = selected.is_demo ? 'DEMO' : 'LIVE';
  const responder = selected.responder_name || 'Unassigned';
  const priority = priorityBand(selected);
  context.innerHTML = `<div><span>SOURCE</span><strong>${source}</strong></div><div><span>STATUS</span><strong>${selected.status.replace('_', ' ').toUpperCase()}</strong></div><div><span>PRIORITY</span><strong class="priority-${priority.cls}">${priority.label} · ${priorityScore(selected)}</strong></div><div><span>RISK</span><strong class="risk-${risk}">${risk.toUpperCase()}${selected.risk_score != null ? ` · ${Math.round(Number(selected.risk_score))}/100` : ''}</strong></div><div><span>RESPONDER</span><strong>${responder}</strong></div><div><span>CITIZEN GPS</span><strong>${formatCoordinate(selected.latitude)}, ${formatCoordinate(selected.longitude)}</strong></div><div><span>GPS ACCURACY</span><strong>${selected.accuracy_m == null ? '—' : `±${Math.round(Number(selected.accuracy_m))} m`}</strong></div><div><span>RAIN · NEXT 6H</span><strong>${selected.precipitation_next_6h_mm == null ? '—' : `${Number(selected.precipitation_next_6h_mm).toFixed(1)} mm`}</strong></div><div><span>PEOPLE</span><strong>${selected.people_count}</strong></div>`;
}

async function refreshRecords() {
  if (loading || !document.querySelector('.ops-shell')) return;
  loading = true;
  try { latestRecords = await citizenSafetyApi.listEmergencies(); }
  catch { /* keep last good snapshot */ }
  finally { loading = false; renderSummary(); }
}

function install() {
  if (!document.querySelector('.ops-shell')) {
    if (pollTimer != null) { window.clearInterval(pollTimer); pollTimer = null; }
    return;
  }
  relabelWorkerShell();
  renderSummary();
  if (pollTimer == null) {
    void refreshRecords();
    pollTimer = window.setInterval(() => void refreshRecords(), 5000);
  }
}

const observer = new MutationObserver(() => {
  if (renderTimer != null) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(install, 80);
});
observer.observe(document.body, { childList: true, subtree: true });
install();
