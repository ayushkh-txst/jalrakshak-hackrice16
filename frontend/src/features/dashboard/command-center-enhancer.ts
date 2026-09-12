import { citizenSafetyApi, type EmergencyRecord } from './api/citizen-safety.api';

let latestRecords: EmergencyRecord[] = [];
let loading = false;
let pollTimer: number | null = null;
let renderTimer: number | null = null;

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

function renderSummary() {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;
  relabelWorkerShell();

  const active = activeRecords();
  const live = active.filter((record) => !record.is_demo);
  const unassigned = live.filter((record) => record.status === 'submitted').length;
  const enRoute = live.filter((record) => record.status === 'en_route').length;
  const critical = live.filter((record) => riskBand(record) === 'critical' || record.emergency_type === 'medical').length;

  let summary = shell.querySelector<HTMLElement>('[data-command-center-summary]');
  if (!summary) {
    summary = document.createElement('section');
    summary.dataset.commandCenterSummary = 'true';
    summary.className = 'command-center-summary';
    const host = shell.querySelector<HTMLElement>('.ops-detail-pane, .ops-map-page');
    host?.prepend(summary);
  }
  if (summary) {
    summary.innerHTML = `
      <div class="command-center-title"><span>COMMAND CENTER</span><strong>Operational overview</strong><small>Live emergency state · refreshes every 5 seconds</small></div>
      <div class="command-center-metric"><span>ACTIVE LIVE</span><strong>${live.length}</strong></div>
      <div class="command-center-metric urgent"><span>UNASSIGNED</span><strong>${unassigned}</strong></div>
      <div class="command-center-metric"><span>EN ROUTE</span><strong>${enRoute}</strong></div>
      <div class="command-center-metric critical"><span>HIGH PRIORITY</span><strong>${critical}</strong></div>`;
  }

  const selected = selectedRecord();
  const detailPane = shell.querySelector<HTMLElement>('.ops-detail-pane');
  let context = detailPane?.querySelector<HTMLElement>('[data-command-center-context]') ?? null;
  if (!selected) {
    context?.remove();
    return;
  }
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
  context.innerHTML = `
    <div><span>SOURCE</span><strong>${source}</strong></div>
    <div><span>STATUS</span><strong>${selected.status.replace('_', ' ').toUpperCase()}</strong></div>
    <div><span>RISK</span><strong class="risk-${risk}">${risk.toUpperCase()}${selected.risk_score != null ? ` · ${Math.round(Number(selected.risk_score))}/100` : ''}</strong></div>
    <div><span>RESPONDER</span><strong>${responder}</strong></div>
    <div><span>CITIZEN GPS</span><strong>${formatCoordinate(selected.latitude)}, ${formatCoordinate(selected.longitude)}</strong></div>
    <div><span>GPS ACCURACY</span><strong>${selected.accuracy_m == null ? '—' : `±${Math.round(Number(selected.accuracy_m))} m`}</strong></div>
    <div><span>RAIN · NEXT 6H</span><strong>${selected.precipitation_next_6h_mm == null ? '—' : `${Number(selected.precipitation_next_6h_mm).toFixed(1)} mm`}</strong></div>
    <div><span>PEOPLE</span><strong>${selected.people_count}</strong></div>`;
}

async function refreshRecords() {
  if (loading || !document.querySelector('.ops-shell')) return;
  loading = true;
  try {
    latestRecords = await citizenSafetyApi.listEmergencies();
    renderSummary();
  } catch {
    renderSummary();
  } finally {
    loading = false;
  }
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
