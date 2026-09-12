import './route-analysis-enhancer.css';

const SUMMARY_CLASS = 'route-analysis-summary';

function getAnalyzedCount(): number | null {
  const statusRows = Array.from(document.querySelectorAll<HTMLElement>('.map-status-row span'));
  for (const row of statusRows) {
    const match = row.textContent?.match(/(\d+)\s+route options considered/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function ensureRouteAnalysisSummary() {
  const routePanel = document.querySelector<HTMLElement>('.route-panel');
  if (!routePanel) return;

  const analyzed = getAnalyzedCount();
  const routeExists = Boolean(document.querySelector('.interactive-safety-map')) && analyzed !== null;

  let summary = routePanel.querySelector<HTMLElement>(`.${SUMMARY_CLASS}`);
  if (!summary) {
    summary = document.createElement('section');
    summary.className = SUMMARY_CLASS;
    summary.setAttribute('aria-label', 'Route analysis summary');

    const originCard = routePanel.querySelector('.route-origin-card');
    const metrics = routePanel.querySelector('.route-metrics');
    if (originCard?.parentElement === routePanel) {
      originCard.insertAdjacentElement('afterend', summary);
    } else if (metrics?.parentElement === routePanel) {
      routePanel.insertBefore(summary, metrics);
    } else {
      routePanel.appendChild(summary);
    }
  }

  if (!routeExists) {
    summary.innerHTML = `
      <div class="route-analysis-heading">
        <span>ROUTE ANALYSIS</span>
        <strong>Waiting for route calculation</strong>
      </div>
      <div class="route-analysis-grid route-analysis-grid--pending">
        <div><b>—</b><span>Analyzed</span></div>
        <div><b>—</b><span>Rejected</span></div>
        <div><b>—</b><span>Viable</span></div>
        <div><b>—</b><span>Recommended</span></div>
      </div>
      <p class="route-analysis-note">Use your location to calculate and compare nearby evacuation routes.</p>
    `;
    return;
  }

  summary.innerHTML = `
    <div class="route-analysis-heading">
      <span>ROUTE ANALYSIS</span>
      <strong>${analyzed} alternatives compared</strong>
    </div>
    <div class="route-analysis-grid">
      <div class="analysis-analyzed"><b>${analyzed}</b><span>Analyzed</span></div>
      <div class="analysis-rejected analysis-pending"><b>—</b><span>Rejected</span></div>
      <div class="analysis-viable analysis-pending"><b>—</b><span>Viable</span></div>
      <div class="analysis-recommended"><b>1</b><span>Recommended</span></div>
    </div>
    <div class="route-analysis-screening">
      <span class="route-analysis-pulse" aria-hidden="true"></span>
      <div>
        <strong>Hazard screening pending</strong>
        <p>Rejected and viable counts will appear here once live hazard and road-closure screening is connected.</p>
      </div>
    </div>
  `;
}

let scheduled = false;
function scheduleUpdate() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    ensureRouteAnalysisSummary();
  });
}

if (typeof window !== 'undefined') {
  const observer = new MutationObserver(scheduleUpdate);
  const start = () => {
    scheduleUpdate();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
