import { citizenSafetyApi, type EmergencyRecord } from './api/citizen-safety.api';

let records: EmergencyRecord[] = [];
let loading = false;
let registryQuery = '';
let registryStatus = 'all';
let registrySource = 'all';

const isResponderPage = () => window.location.pathname.includes('/responder');
const actionable = (r: EmergencyRecord) => ['submitted', 'assigned', 'en_route'].includes(r.status);

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusLabel(status: string) {
  if (status === 'submitted') return 'NEW';
  if (status === 'assigned') return 'ASSIGNED';
  if (status === 'en_route') return 'EN ROUTE';
  if (status === 'resolved') return 'RESOLVED';
  return status.toUpperCase();
}

function typeLabel(type: string) {
  if (type === 'rescue') return 'Trapped Response';
  if (type === 'medical') return 'Medical Response';
  return 'Evacuation Response';
}

function timeAgo(iso: string) {
  const elapsed = Math.max(0, Date.now() - Date.parse(iso));
  const min = Math.floor(elapsed / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function shell() {
  return document.querySelector<HTMLElement>('.ops-shell');
}

function navButton(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.ops-nav button'))
    .find((button) => button.querySelector('span')?.textContent?.trim() === label) ?? null;
}

function setActiveNav(label: string) {
  document.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((button) => {
    button.classList.toggle('active', button.querySelector('span')?.textContent?.trim() === label);
  });
}

function hideOperationalPanels() {
  document.querySelectorAll<HTMLElement>('.ops-queue-pane,.ops-detail-pane,.ops-map-page').forEach((el) => {
    el.style.display = 'none';
  });
  document.querySelectorAll<HTMLElement>('.command-center-static-view').forEach((el) => {
    if (!el.dataset.incidentRegistryV2) el.remove();
  });
}

function showOperationalPanels() {
  document.querySelector<HTMLElement>('[data-incident-registry-v2]')?.remove();
  const queue = document.querySelector<HTMLElement>('.ops-queue-pane');
  const detail = document.querySelector<HTMLElement>('.ops-detail-pane');
  if (queue) queue.style.display = '';
  if (detail) detail.style.display = '';
  setActiveNav('Incident Queue');
  enforceActionableQueue();
}

async function refreshRecords() {
  if (loading) return;
  loading = true;
  try {
    records = (await citizenSafetyApi.listEmergencies()).filter((r) => r.status !== 'cancelled');
  } catch {
    // Keep the last successful snapshot. The existing queue already owns error UI.
  } finally {
    loading = false;
  }
}

function registryFiltered() {
  const q = registryQuery.trim().toLowerCase();
  return records
    .filter((r) => registryStatus === 'all' || r.status === registryStatus)
    .filter((r) => registrySource === 'all' || (registrySource === 'live' ? !r.is_demo : Boolean(r.is_demo)))
    .filter((r) => !q || [r.id, r.citizen_name, r.emergency_type, r.status, r.notes].join(' ').toLowerCase().includes(q))
    .sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at));
}

function registryStats() {
  const total = records.length;
  const active = records.filter(actionable).length;
  const resolved = records.filter((r) => r.status === 'resolved').length;
  const live = records.filter((r) => !r.is_demo).length;
  return { total, active, resolved, live };
}

function registryMarkup() {
  const filtered = registryFiltered();
  const stats = registryStats();
  return `
    <header class="incident-registry-header">
      <div>
        <span class="incident-registry-eyebrow">ALL INCIDENTS</span>
        <h1>Incident registry</h1>
        <p>Search every response record. Active operational work stays in Incident Queue.</p>
      </div>
      <button type="button" data-open-active-queue>Open Incident Queue →</button>
    </header>

    <section class="incident-registry-stats">
      <article><span>TOTAL RECORDS</span><strong>${stats.total}</strong><small>Live + demo history</small></article>
      <article><span>ACTIVE</span><strong>${stats.active}</strong><small>Needs operational attention</small></article>
      <article><span>RESOLVED</span><strong>${stats.resolved}</strong><small>Closed response records</small></article>
      <article><span>LIVE RECORDS</span><strong>${stats.live}</strong><small>Citizen-created incidents</small></article>
    </section>

    <section class="incident-registry-toolbar">
      <label class="incident-registry-search"><span>⌕</span><input data-registry-search value="${escapeHtml(registryQuery)}" placeholder="Search ID, citizen, type, notes…" /></label>
      <div class="incident-registry-filter-group" data-status-filter>
        ${[['all','All'],['submitted','New'],['assigned','Assigned'],['en_route','En Route'],['resolved','Resolved']].map(([key,label]) => `<button type="button" data-registry-status="${key}" class="${registryStatus === key ? 'active' : ''}">${label}</button>`).join('')}
      </div>
      <div class="incident-registry-filter-group compact" data-source-filter>
        ${[['all','All sources'],['live','Live'],['demo','Demo']].map(([key,label]) => `<button type="button" data-registry-source="${key}" class="${registrySource === key ? 'active' : ''}">${label}</button>`).join('')}
      </div>
    </section>

    <section class="incident-registry-table-wrap">
      <div class="incident-registry-table-head"><span>INCIDENT</span><span>TYPE</span><span>PEOPLE</span><span>STATUS</span><span>SOURCE</span><span>UPDATED</span><span></span></div>
      <div class="incident-registry-list">
        ${filtered.length ? filtered.map((r) => `
          <article class="incident-registry-row" data-registry-id="${escapeHtml(r.id)}">
            <div class="registry-primary"><strong>${escapeHtml(r.citizen_name)}</strong><span>${escapeHtml(r.id)}</span><small>${escapeHtml(Number(r.latitude).toFixed(4))}, ${escapeHtml(Number(r.longitude).toFixed(4))}</small></div>
            <div><span class="registry-type ${escapeHtml(r.emergency_type)}">${typeLabel(r.emergency_type)}</span></div>
            <div><strong>${Number(r.people_count || 1)}</strong></div>
            <div><span class="registry-status ${escapeHtml(r.status)}">${statusLabel(r.status)}</span></div>
            <div><span class="registry-source ${r.is_demo ? 'demo' : 'live'}">${r.is_demo ? 'DEMO' : 'LIVE'}</span></div>
            <div><span>${timeAgo(r.updated_at || r.created_at)}</span></div>
            <div class="registry-actions">${actionable(r) ? `<button type="button" data-open-queue-id="${escapeHtml(r.id)}">Open in Queue</button>` : `<button type="button" data-registry-inspect="${escapeHtml(r.id)}">View record</button>`}</div>
          </article>`).join('') : `<div class="incident-registry-empty">No incidents match these filters.</div>`}
      </div>
    </section>`;
}

function wireRegistry(view: HTMLElement) {
  view.querySelector<HTMLButtonElement>('[data-open-active-queue]')?.addEventListener('click', () => openQueue());

  const search = view.querySelector<HTMLInputElement>('[data-registry-search]');
  search?.addEventListener('input', () => {
    registryQuery = search.value;
    renderRegistry(false);
    requestAnimationFrame(() => {
      const next = document.querySelector<HTMLInputElement>('[data-registry-search]');
      next?.focus();
      next?.setSelectionRange(registryQuery.length, registryQuery.length);
    });
  });

  view.querySelectorAll<HTMLButtonElement>('[data-registry-status]').forEach((button) => button.addEventListener('click', () => {
    registryStatus = button.dataset.registryStatus || 'all';
    renderRegistry(false);
  }));
  view.querySelectorAll<HTMLButtonElement>('[data-registry-source]').forEach((button) => button.addEventListener('click', () => {
    registrySource = button.dataset.registrySource || 'all';
    renderRegistry(false);
  }));
  view.querySelectorAll<HTMLButtonElement>('[data-open-queue-id]').forEach((button) => button.addEventListener('click', () => {
    openQueue(button.dataset.openQueueId || '');
  }));
  view.querySelectorAll<HTMLButtonElement>('[data-registry-inspect]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.registryInspect || '';
    const record = records.find((r) => r.id === id);
    if (!record) return;
    const row = button.closest<HTMLElement>('.incident-registry-row');
    if (!row) return;
    row.classList.toggle('expanded');
    let detail = row.nextElementSibling as HTMLElement | null;
    if (detail?.classList.contains('incident-registry-detail')) {
      detail.remove();
      return;
    }
    detail = document.createElement('div');
    detail.className = 'incident-registry-detail';
    detail.innerHTML = `<div><span>NOTES</span><p>${escapeHtml(record.notes || 'No citizen note provided.')}</p></div><div><span>RESPONDER</span><p>${escapeHtml(record.responder_name || 'Unassigned')}</p></div><div><span>RISK</span><p>${escapeHtml(record.risk_level || '—')} · ${escapeHtml(record.risk_score ?? '—')}/100</p></div><div><span>CREATED</span><p>${escapeHtml(new Date(record.created_at).toLocaleString())}</p></div>`;
    row.insertAdjacentElement('afterend', detail);
  }));
}

async function renderRegistry(load = true) {
  if (!isResponderPage()) return;
  if (load) await refreshRecords();
  const root = shell();
  if (!root) return;
  hideOperationalPanels();
  let view = root.querySelector<HTMLElement>('[data-incident-registry-v2]');
  if (!view) {
    view = document.createElement('section');
    view.dataset.incidentRegistryV2 = 'true';
    view.className = 'command-center-static-view incident-registry-v2';
    root.appendChild(view);
  }
  view.innerHTML = registryMarkup();
  setActiveNav('All Incidents');
  wireRegistry(view);
}

function findQueueCard(id: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.ops-queue-list > button')).find((card) => card.querySelector('.queue-top > span')?.textContent?.trim() === id) ?? null;
}

function enforceActionableQueue() {
  if (!isResponderPage() || document.querySelector('[data-incident-registry-v2]')) return;
  const byId = new Map(records.map((r) => [r.id, r]));
  const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('.ops-queue-list > button'));
  cards.forEach((card) => {
    const id = card.querySelector('.queue-top > span')?.textContent?.trim() || '';
    const record = byId.get(id);
    if (record && !actionable(record)) card.style.display = 'none';
  });

  document.querySelectorAll<HTMLButtonElement>('[data-incident-filter]').forEach((button) => {
    const key = button.dataset.incidentFilter;
    if (key === 'resolved') button.style.display = 'none';
    if (key === 'all') {
      const count = records.filter(actionable).length;
      const badge = button.querySelector('b');
      if (badge) badge.textContent = String(count);
    }
  });

  const selectedId = document.querySelector<HTMLElement>('.ops-id-row > span')?.textContent?.trim() || '';
  const selected = byId.get(selectedId);
  if (selected && !actionable(selected)) {
    const first = records.find(actionable);
    const card = first ? findQueueCard(first.id) : null;
    if (card && card.offsetParent !== null) card.click();
  }

  const heading = document.querySelector<HTMLElement>('.ops-queue-pane header h2');
  if (heading) heading.textContent = 'Active Response Queue';
  const subtitle = document.querySelector<HTMLElement>('.ops-queue-pane header span');
  if (subtitle) subtitle.textContent = 'New · Assigned · En Route · auto-refresh 5s';
}

async function openQueue(preferredId = '') {
  await refreshRecords();
  showOperationalPanels();
  requestAnimationFrame(() => {
    enforceActionableQueue();
    const targetId = preferredId && records.find((r) => r.id === preferredId && actionable(r)) ? preferredId : records.find(actionable)?.id || '';
    const card = targetId ? findQueueCard(targetId) : null;
    card?.click();
  });
}

function handleNavClick(event: Event) {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.ops-nav button');
  const label = button?.querySelector('span')?.textContent?.trim();
  if (label === 'All Incidents') {
    window.setTimeout(() => void renderRegistry(true), 0);
  } else if (label === 'Incident Queue' || label === 'Emergency Queue') {
    window.setTimeout(() => void openQueue(), 0);
  } else if (label) {
    document.querySelector<HTMLElement>('[data-incident-registry-v2]')?.remove();
  }
}

function start() {
  if (!isResponderPage()) return;
  document.addEventListener('click', handleNavClick, true);
  void refreshRecords().then(() => enforceActionableQueue());
  window.setInterval(() => {
    void refreshRecords().then(() => {
      const registry = document.querySelector<HTMLElement>('[data-incident-registry-v2]');
      if (registry) renderRegistry(false);
      else enforceActionableQueue();
    });
  }, 5000);

  const observer = new MutationObserver(() => {
    if (!document.querySelector('[data-incident-registry-v2]')) enforceActionableQueue();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
