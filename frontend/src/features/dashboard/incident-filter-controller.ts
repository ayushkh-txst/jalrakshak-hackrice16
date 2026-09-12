import { citizenSafetyApi, type EmergencyListFilters, type EmergencyRecord } from './api/citizen-safety.api';

type FilterKey = 'all' | 'new' | 'assigned' | 'en_route' | 'resolved' | 'live' | 'demo';

const FILTER_SELECTOR = '[data-command-center-filters] [data-incident-filter]';
const CARD_SELECTOR = '.ops-queue-list > button';

let activeFilter: FilterKey = 'all';
let allRecords: EmergencyRecord[] = [];
let filteredRecords: EmergencyRecord[] = [];
let loading = false;
let applying = false;

function onResponder() {
  return window.location.pathname.includes('/responder');
}

function filterToApi(key: FilterKey): EmergencyListFilters | undefined {
  if (key === 'new') return { status: 'submitted' };
  if (key === 'assigned') return { status: 'assigned' };
  if (key === 'en_route') return { status: 'en_route' };
  if (key === 'resolved') return { status: 'resolved' };
  if (key === 'live') return { is_demo: false };
  if (key === 'demo') return { is_demo: true };
  return undefined;
}

function matches(record: EmergencyRecord, key: FilterKey) {
  if (record.status === 'cancelled') return false;
  if (key === 'all') return true;
  if (key === 'new') return record.status === 'submitted';
  if (key === 'assigned') return record.status === 'assigned';
  if (key === 'en_route') return record.status === 'en_route';
  if (key === 'resolved') return record.status === 'resolved';
  if (key === 'live') return !record.is_demo;
  return Boolean(record.is_demo);
}

function cardId(card: HTMLElement) {
  return card.querySelector<HTMLElement>('.queue-top > span')?.textContent?.trim() || '';
}

function countFor(key: FilterKey) {
  return allRecords.filter((record) => matches(record, key)).length;
}

function decorateFilters() {
  const host = document.querySelector<HTMLElement>('[data-command-center-filters]');
  if (!host) return;
  host.classList.add('incident-filter-grid');

  host.querySelectorAll<HTMLButtonElement>('[data-incident-filter]').forEach((button) => {
    const key = (button.dataset.incidentFilter || 'all') as FilterKey;
    button.disabled = false;
    button.style.pointerEvents = 'auto';
    button.classList.toggle('active', key === activeFilter);
    button.setAttribute('aria-pressed', String(key === activeFilter));
    const badge = button.querySelector<HTMLElement>('b');
    if (badge) badge.textContent = String(countFor(key));
    if (key === 'demo') button.classList.add('incident-filter-full-row');
    else button.classList.remove('incident-filter-full-row');
  });
}

function renderEmpty(list: HTMLElement, message: string) {
  let empty = list.querySelector<HTMLElement>('[data-queue-filter-empty-v3]');
  if (!empty) {
    empty = document.createElement('div');
    empty.dataset.queueFilterEmptyV3 = 'true';
    empty.className = 'queue-filter-empty-v3';
    list.appendChild(empty);
  }
  empty.textContent = message;
}

function clearEmpty(list: HTMLElement) {
  list.querySelector<HTMLElement>('[data-queue-filter-empty-v3]')?.remove();
}

function applyRecords(records: EmergencyRecord[]) {
  if (applying) return;
  applying = true;
  try {
    const list = document.querySelector<HTMLElement>('.ops-queue-list');
    if (!list) return;

    const allowed = new Set(records.filter((record) => matches(record, activeFilter)).map((record) => record.id));
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>(CARD_SELECTOR));
    let firstVisible: HTMLButtonElement | null = null;
    let visible = 0;

    cards.forEach((card) => {
      const id = cardId(card);
      const show = allowed.has(id);
      card.style.setProperty('display', show ? '' : 'none', show ? '' : 'important');
      card.style.pointerEvents = show ? 'auto' : 'none';
      if (show) {
        visible += 1;
        if (!firstVisible) firstVisible = card;
      }
    });

    if (!visible) {
      const label = activeFilter === 'all' ? 'incidents' : activeFilter.replace('_', ' ');
      renderEmpty(list, `No ${label} incidents right now.`);
    } else {
      clearEmpty(list);
    }

    const selected = cards.find((card) => card.classList.contains('active'));
    if (selected && selected.style.display === 'none') firstVisible?.click();
  } finally {
    applying = false;
  }
}

async function loadAllRecords() {
  try {
    allRecords = (await citizenSafetyApi.listEmergencies()).filter((record) => record.status !== 'cancelled');
  } catch {
    // Keep the most recent successful snapshot.
  }
  decorateFilters();
}

async function loadFilteredRecords(key: FilterKey) {
  if (loading) return;
  loading = true;
  const requestedFilter = filterToApi(key);
  try {
    const serverRecords = await citizenSafetyApi.listEmergencies(requestedFilter);
    // Some prototype backends may ignore query params, so enforce the same filter client-side too.
    filteredRecords = serverRecords.filter((record) => matches(record, key));
  } catch {
    // Backward compatibility with a backend that has not deployed query parameters yet.
    if (!allRecords.length) {
      try { allRecords = await citizenSafetyApi.listEmergencies(); } catch { allRecords = []; }
    }
    filteredRecords = allRecords.filter((record) => matches(record, key));
  } finally {
    loading = false;
  }
  applyRecords(filteredRecords);
  decorateFilters();
}

async function activateFilter(key: FilterKey) {
  activeFilter = key;
  decorateFilters();
  await loadFilteredRecords(key);
}

function filterFromTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest<HTMLButtonElement>(FILTER_SELECTOR);
  if (!button) return null;
  return ((button.dataset.incidentFilter || 'all') as FilterKey);
}

function onClick(event: MouseEvent) {
  const key = filterFromTarget(event.target);
  if (!key) return;
  // This controller is the final owner of filtering; stop older enhancers from fighting it.
  event.preventDefault();
  event.stopImmediatePropagation();
  void activateFilter(key);
}

let mutationTimer = 0;
function scheduleDecorate() {
  window.clearTimeout(mutationTimer);
  mutationTimer = window.setTimeout(() => {
    decorateFilters();
    if (filteredRecords.length || activeFilter !== 'all') applyRecords(filteredRecords.length ? filteredRecords : allRecords.filter((r) => matches(r, activeFilter)));
  }, 40);
}

async function start() {
  if (!onResponder()) return;
  document.addEventListener('click', onClick, true);
  await loadAllRecords();
  filteredRecords = allRecords.filter((record) => matches(record, activeFilter));
  applyRecords(filteredRecords);
  decorateFilters();

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] });

  window.setInterval(async () => {
    await loadAllRecords();
    await loadFilteredRecords(activeFilter);
  }, 5000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else void start();
