const TEXAS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Bagmati Valley,?\s*Sindhupalchowk/gi, 'Houston, Harris County'],
  [/Bagmati Valley\s*·\s*Sindhupalchowk/gi, 'Houston · Harris County'],
  [/Sindhupalchowk/gi, 'Harris County'],
  [/Sindhupalchok/gi, 'Harris County'],
  [/Nepal Flood Intelligence Network/gi, 'Texas Gulf Flood Intelligence'],
  [/Nepal Flood Intelligence/gi, 'Texas Gulf Flood Intelligence'],
];

function normalizeVisibleLocationText(root: Node = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const original = node.nodeValue ?? '';
    let next = original;
    for (const [pattern, replacement] of TEXAS_REPLACEMENTS) next = next.replace(pattern, replacement);
    if (next !== original) node.nodeValue = next;
  }
}

function dashboardButtonFromEvent(event: Event) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('.ops-nav button');
  if (!button) return null;
  return button.querySelector('span')?.textContent?.trim() === 'Dashboard' ? button : null;
}

function openStableDashboardShell(button: HTMLButtonElement) {
  const shell = document.querySelector<HTMLElement>('.ops-shell');
  if (!shell) return;

  shell.querySelector<HTMLElement>('.command-center-static-view')?.remove();
  shell.querySelectorAll<HTMLElement>('.ops-queue-pane,.ops-detail-pane,.ops-map-page').forEach((el) => {
    el.style.display = 'none';
  });

  const host = document.createElement('section');
  host.className = 'command-center-static-view admin-dashboard-stable-host';
  shell.appendChild(host);

  document.querySelectorAll<HTMLButtonElement>('.ops-nav button').forEach((nav) => {
    if (nav.querySelector('span')?.textContent?.trim() !== 'Live Map') {
      nav.classList.toggle('active', nav === button);
    }
  });
}

// The older command-center enhancer also owns the Dashboard button and re-renders
// a legacy Nepal dashboard every refresh. Intercept that click before its target
// handler runs. The newer admin-dashboard enhancer (registered earlier on document)
// still receives the click and renders into this stable host.
document.addEventListener('click', (event) => {
  const button = dashboardButtonFromEvent(event);
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openStableDashboardShell(button);
}, true);

let scheduled = false;
function scheduleNormalize() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    normalizeVisibleLocationText();
  });
}

const observer = new MutationObserver(scheduleNormalize);
const start = () => {
  normalizeVisibleLocationText();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
