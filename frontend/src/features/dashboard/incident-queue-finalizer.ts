import { citizenSafetyApi, type EmergencyRecord } from './api/citizen-safety.api';

let records: EmergencyRecord[] = [];
let busy = false;

const actionable = (record: EmergencyRecord) => ['submitted', 'assigned', 'en_route'].includes(record.status);
const onResponder = () => window.location.pathname.includes('/responder');

async function refreshRecords() {
  if (busy) return;
  busy = true;
  try {
    records = (await citizenSafetyApi.listEmergencies()).filter((record) => record.status !== 'cancelled');
  } catch {
    // Keep the last successful snapshot.
  } finally {
    busy = false;
  }
}

function cardId(card: HTMLElement) {
  return card.querySelector<HTMLElement>('.queue-top > span')?.textContent?.trim() || '';
}

function selectedIncidentId() {
  return document.querySelector<HTMLElement>('.ops-id-row > span')?.textContent?.trim() || '';
}

function enforceActiveQueue() {
  if (!onResponder()) return;
  const queuePane = document.querySelector<HTMLElement>('.ops-queue-pane');
  const registryOpen = Boolean(document.querySelector('[data-incident-registry-v2]'));
  if (!queuePane || registryOpen || queuePane.style.display === 'none') return;

  const byId = new Map(records.map((record) => [record.id, record]));
  const cards = Array.from(queuePane.querySelectorAll<HTMLElement>('.ops-queue-list > button'));

  let visibleActionable = 0;
  cards.forEach((card) => {
    const record = byId.get(cardId(card));
    const keep = record ? actionable(record) : true;
    card.dataset.queueActionable = keep ? 'true' : 'false';
    if (!keep) {
      card.style.setProperty('display', 'none', 'important');
    } else {
      card.style.removeProperty('display');
      visibleActionable += 1;
    }
  });

  const filters = Array.from(queuePane.querySelectorAll<HTMLButtonElement>('[data-incident-filter]'));
  filters.forEach((button) => {
    const key = button.dataset.incidentFilter || '';
    if (key === 'resolved') {
      button.style.setProperty('display', 'none', 'important');
      if (button.classList.contains('active')) {
        button.classList.remove('active');
        const all = queuePane.querySelector<HTMLButtonElement>('[data-incident-filter="all"]');
        all?.classList.add('active');
      }
    }
    if (key === 'all') {
      const count = button.querySelector('b');
      if (count) count.textContent = String(records.filter(actionable).length || visibleActionable);
    }
  });

  const heading = queuePane.querySelector<HTMLElement>('header h2');
  if (heading) heading.textContent = 'Active Response Queue';
  const headerText = queuePane.querySelector<HTMLElement>('header span');
  if (headerText) headerText.textContent = 'New · Assigned · En Route · auto-refresh 5s';

  const current = byId.get(selectedIncidentId());
  if (current && !actionable(current)) {
    const nextCard = cards.find((card) => card.dataset.queueActionable === 'true' && card.offsetParent !== null) as HTMLButtonElement | undefined;
    nextCard?.click();
  }
}

function enforce() {
  enforceActiveQueue();
}

function start() {
  if (!onResponder()) return;

  void refreshRecords().then(enforce);

  const observer = new MutationObserver(() => enforce());
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

  window.setInterval(() => {
    void refreshRecords().then(enforce);
  }, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
