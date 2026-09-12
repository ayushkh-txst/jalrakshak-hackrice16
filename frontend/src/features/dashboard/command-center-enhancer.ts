import { citizenSafetyApi, type EmergencyRecord } from './api/citizen-safety.api';

type IncidentFilter = 'all' | 'new' | 'assigned' | 'en_route' | 'resolved' | 'live' | 'demo';

let latestRecords: EmergencyRecord[] = [];
let loading = false;
let pollTimer: number | null = null;
let renderTimer: number | null = null;
let activeFilter: IncidentFilter = 'all';

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
  let score = 0;
  if (record.emergency_type === 'medical') score += 36;
  else if (record.emergency_type === 'rescue') score += 30;
  else score += 18;

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
  if (subtitle) subtitle.textContent = 'Command Center';
  const role = shell.querySelector<HTMLElement>('.ops-role');
  if (role) role.textContent = 'ADMIN + RESPONSE';
  const userRole = shell.querySelector<HTMLElement>('.ops-user small');
  if (userRole) userRole.textContent = 'Coordinator / Responder';

  shell.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    const span = button.querySelector('span');
    if (!span) return;
    if (span.textContent?.trim() === 'Dashboard') span.textContent = 'Command Center';
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
    card.dataset.priorityScore = String(priorityScore(record));
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

function renderStaticView(kind: 'dashboard' | 'incidents' | 'chat' | 'reports' | 'settings') {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  shell.querySelector<HTMLElement>('.command-center-static-view')?.remove();
  shell.querySelectorAll<HTMLElement>('.ops-queue-pane,.ops-detail-pane,.ops-map-page').forEach((el) => { el.style.display = 'none'; });

  const view = document.createElement('section');
  view.className = 'command-center-static-view';
  const active = activeRecords();
  const unresolved = latestRecords.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled');
  const high = unresolved.filter((r) => ['critical', 'high'].includes(priorityBand(r).cls)).length;
  const unassigned = unresolved.filter((r) => r.status === 'submitted').length;
  const enRoute = unresolved.filter((r) => r.status === 'en_route').length;

  if (kind === 'dashboard') {
    const top = [...unresolved].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 5);
    view.innerHTML = `<header><span>COMMAND CENTER</span><h1>Operational dashboard</h1><p>Live incident state from the emergency backend.</p></header><div class="command-center-dashboard-metrics"><div><span>ACTIVE</span><strong>${active.length}</strong></div><div><span>UNASSIGNED</span><strong>${unassigned}</strong></div><div><span>EN ROUTE</span><strong>${enRoute}</strong></div><div><span>HIGH PRIORITY</span><strong>${high}</strong></div></div><article class="command-center-top-incidents"><span>TOP PRIORITY INCIDENTS</span>${top.length ? top.map((r) => `<div><b class="priority-${priorityBand(r).cls}">${priorityBand(r).label}</b><strong>${r.citizen_name}</strong><small>${r.emergency_type.toUpperCase()} · ${r.people_count} ${r.people_count === 1 ? 'person' : 'people'} · score ${priorityScore(r)}</small></div>`).join('') : '<p>No active incidents.</p>'}</article>`;
  } else if (kind === 'incidents') {
    view.innerHTML = `<header><span>ALL INCIDENTS</span><h1>Incident registry</h1><p>Use the Incident Queue filters to inspect live, demo, assigned, en-route, and resolved incidents.</p></header><button class="command-center-open-queue">Open Incident Queue</button>`;
    view.querySelector<HTMLButtonElement>('.command-center-open-queue')?.addEventListener('click', () => restoreQueue('all'));
  } else if (kind === 'chat') {
    view.innerHTML = `<header><span>NAVCAT · COMMAND CENTER</span><h1>Operational AI Assistant</h1><p>Responder/Admin NavCat is the next project step after the Command Center foundation is complete.</p></header><div class="command-center-coming-soon">Planned tools: summarize SOS, rank incidents, explain priority, locate citizens, inspect hazards, and prepare responder routes.</div>`;
  } else if (kind === 'reports') {
    view.innerHTML = `<header><span>REPORTS</span><h1>Operational reporting</h1><p>Incident counts and response performance will live here.</p></header><div class="command-center-dashboard-metrics"><div><span>TOTAL INCIDENTS</span><strong>${latestRecords.length}</strong></div><div><span>ACTIVE</span><strong>${active.length}</strong></div><div><span>RESOLVED</span><strong>${latestRecords.filter((r) => r.status === 'resolved').length}</strong></div><div><span>LIVE SOURCE</span><strong>${latestRecords.filter((r) => !r.is_demo).length}</strong></div></div>`;
  } else {
    view.innerHTML = `<header><span>SETTINGS</span><h1>Command Center settings</h1><p>Role permissions, alert thresholds, integrations, and audit controls will be configured here during the security pass.</p></header>`;
  }
  shell.appendChild(view);
  markNavActive(kind === 'dashboard' ? 'Command Center' : kind === 'incidents' ? 'All Incidents' : kind === 'chat' ? 'AI Assistant' : kind === 'reports' ? 'Reports' : 'Settings');
}

function restoreQueue(filter?: IncidentFilter) {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  shell.querySelector<HTMLElement>('.command-center-static-view')?.remove();
  shell.querySelector<HTMLElement>('.ops-queue-pane')?.style.removeProperty('display');
  shell.querySelector<HTMLElement>('.ops-detail-pane')?.style.removeProperty('display');
  if (filter) activeFilter = filter;
  renderFilters();
  applyQueueSortingAndFilter();
  markNavActive('Incident Queue');
}

function markNavActive(label: string) {
  document.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    const text = button.querySelector('span')?.textContent?.trim();
    if (text === 'Live Map' || text === 'Incident Queue') return;
    button.classList.toggle('active', text === label);
  });
}

function wireNavigation() {
  document.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    if (button.dataset.commandCenterWired === 'true') return;
    const label = button.querySelector('span')?.textContent?.trim();
    if (!label) return;
    button.dataset.commandCenterWired = 'true';
    if (label === 'Command Center') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('dashboard'); });
    else if (label === 'All Incidents') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('incidents'); });
    else if (label === 'AI Assistant') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('chat'); });
    else if (label === 'Reports') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('reports'); });
    else if (label === 'Settings') button.addEventListener('click', (event) => { event.preventDefault(); renderStaticView('settings'); });
    else if (label === 'Incident Queue') button.addEventListener('click', () => restoreQueue(activeFilter));
    else if (label === 'Live Map') button.addEventListener('click', () => { document.querySelector<HTMLElement>('.command-center-static-view')?.remove(); });
  });
}

function renderSummary() {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  relabelWorkerShell();
  wireNavigation();
  renderFilters();
  applyQueueSortingAndFilter();

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
  if (summary) {
    summary.innerHTML = `<div class="command-center-title"><span>COMMAND CENTER</span><strong>Operational overview</strong><small>Live emergency state · refreshes every 5 seconds</small></div><div class="command-center-metric"><span>ACTIVE LIVE</span><strong>${live.length}</strong></div><div class="command-center-metric urgent"><span>UNASSIGNED</span><strong>${unassigned}</strong></div><div class="command-center-metric"><span>EN ROUTE</span><strong>${enRoute}</strong></div><div class="command-center-metric critical"><span>HIGH PRIORITY</span><strong>${critical}</strong></div>`;
  }

  const selected = selectedRecord();
  const detailPane = shell.querySelector<HTMLElement>('.ops-detail-pane');
  let context = detailPane?.querySelector<HTMLElement>('[data-command-center-context]') ?? null;
  if (!selected) { context?.remove(); return; }
  if (!context) {
    context = document.createElement('section');
    context.dataset.commandCenterContext = 'true';
    context.className = 'command-center-context';
    const header = detailPane?.querySelector('.ops-detail-header');
    header?.insertAdjacentElement('afterend', context);
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
  try {
    latestRecords = await citizenSafetyApi.listEmergencies();
    renderSummary();
  } catch { renderSummary(); }
  finally { loading = false; }
}

function install() {
  if (!document.querySelector('.ops-shell')) {
    if (pollTimer != null) { window.clearInterval(pollTimer); pollTimer = null; }
    return;
  }
  renderSummary();
  if (pollTimer == null) {
    void refreshRecords();
    pollTimer = window.setInterval(() => void refreshRecords(), 5000);
  }
}

const observer = new MutationObserver(() => {
  if (renderTimer != null) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(install, 60);
});
observer.observe(document.body, { childList: true, subtree: true });
install();
