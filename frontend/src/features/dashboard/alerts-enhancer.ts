type RouteAnalysisDetail = {
  alternatives_considered?: number;
  rejected_count?: number;
  viable_count?: number;
  screening_status?: 'pending' | 'complete';
  prototype_safety_score?: number;
  warning?: string;
};

let latestRoute: RouteAnalysisDetail | null = null;
let lastRenderedLocation = '';

function findNavButton(label: string): HTMLButtonElement | null {
  return [...document.querySelectorAll<HTMLButtonElement>('.figma-nav button')]
    .find((button) => button.textContent?.trim().includes(label)) ?? null;
}

function currentLocationLabel(): string {
  const topbar = document.querySelector<HTMLElement>('.location-line');
  const raw = topbar?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!raw || raw.includes('Bagmati Valley, Sindhupalchowk')) return 'Current configured area';
  return raw.replace(/^⌖\s*/, '').replace(/\s*·\s*LIVE\s*$/, '').trim();
}

function severityFromRoute(): { label: string; cls: string; score: string } {
  const score = latestRoute?.prototype_safety_score;
  if (typeof score !== 'number') return { label: 'MONITOR', cls: 'monitor', score: '—' };
  if (score < 45) return { label: 'HIGH', cls: 'high', score: `${score}/100` };
  if (score < 75) return { label: 'ELEVATED', cls: 'elevated', score: `${score}/100` };
  return { label: 'LOW', cls: 'low', score: `${score}/100` };
}

function renderAlertsScreen(section: HTMLElement) {
  const location = currentLocationLabel();
  const severity = severityFromRoute();
  const analyzed = latestRoute?.alternatives_considered ?? 0;
  const rejected = latestRoute?.rejected_count;
  const viable = latestRoute?.viable_count;
  const screeningComplete = latestRoute?.screening_status === 'complete';

  section.className = 'citizen-alerts-screen';
  section.innerHTML = `
    <div class="alerts-heading-row">
      <div>
        <span class="safe-eyebrow">ALERTS & ADVISORIES</span>
        <h1>What needs your attention</h1>
        <p>JalRakshak separates modeled safety advisories from official emergency warnings so the source is always clear.</p>
      </div>
      <div class="alerts-live-chip"><i></i> LIVE CONTEXT</div>
    </div>

    <section class="alerts-summary-grid" aria-label="Alert summary">
      <article><span>ACTIVE</span><strong>2</strong><small>items requiring attention</small></article>
      <article><span>AREA</span><strong class="alerts-area-name">${escapeHtml(location)}</strong><small>current map context</small></article>
      <article><span>ROUTES</span><strong>${analyzed || '—'}</strong><small>${analyzed ? 'alternatives analyzed' : 'calculate route to analyze'}</small></article>
      <article><span>MODEL SCORE</span><strong>${severity.score}</strong><small>prototype only</small></article>
    </section>

    <div class="alerts-content-grid">
      <div class="alerts-list-column">
        <article class="alert-card alert-card-primary ${severity.cls}">
          <div class="alert-card-topline">
            <span class="alert-source-badge modeled">MODELED</span>
            <span class="alert-severity ${severity.cls}">${severity.label}</span>
            <span class="alert-time">Updated just now</span>
          </div>
          <div class="alert-card-main">
            <div class="alert-symbol">△</div>
            <div>
              <h2>Flood-risk safety advisory</h2>
              <p>JalRakshak is using the current environmental context and route model to help you plan. This is a prototype advisory, not an official government warning.</p>
            </div>
          </div>
          <div class="alert-detail-grid">
            <div><span>AFFECTED AREA</span><strong>${escapeHtml(location)}</strong></div>
            <div><span>RECOMMENDED ACTION</span><strong>Review the safest available route</strong></div>
          </div>
          <div class="alert-actions">
            <button type="button" data-alert-action="map" class="alert-primary-action">OPEN LIVE MAP</button>
            <button type="button" data-alert-action="help" class="alert-secondary-action">I NEED HELP</button>
          </div>
        </article>

        <article class="alert-card route-alert-card">
          <div class="alert-card-topline">
            <span class="alert-source-badge system">SYSTEM</span>
            <span class="alert-severity route">ROUTING</span>
            <span class="alert-time">Live</span>
          </div>
          <div class="alert-card-main">
            <div class="alert-symbol route-symbol">↗</div>
            <div>
              <h2>Route safety analysis</h2>
              <p>${analyzed
                ? `JalRakshak analyzed ${analyzed} route option${analyzed === 1 ? '' : 's'}${screeningComplete && typeof rejected === 'number' && typeof viable === 'number' ? `: ${rejected} rejected and ${viable} viable.` : '.'}`
                : 'Use your location on the Live Map to compare real-road evacuation options.'}</p>
            </div>
          </div>
          <div class="alert-detail-grid">
            <div><span>SCREENING</span><strong>${screeningComplete ? 'Complete' : analyzed ? 'In progress / limited' : 'Not started'}</strong></div>
            <div><span>STATUS</span><strong>${screeningComplete && typeof rejected === 'number' ? `${rejected} rejected` : 'Awaiting route analysis'}</strong></div>
          </div>
          ${latestRoute?.warning ? `<div class="alert-caveat">${escapeHtml(latestRoute.warning)}</div>` : ''}
          <div class="alert-actions">
            <button type="button" data-alert-action="map" class="alert-primary-action">VIEW ROUTES</button>
          </div>
        </article>
      </div>

      <aside class="alerts-side-panel">
        <section>
          <span class="safe-eyebrow">SOURCE CLARITY</span>
          <h3>Know what you're seeing</h3>
          <div class="source-explainer"><b class="source-dot official"></b><div><strong>OFFICIAL</strong><p>Government or emergency-agency warning feeds when connected.</p></div></div>
          <div class="source-explainer"><b class="source-dot modeled"></b><div><strong>MODELED</strong><p>JalRakshak prototype risk calculations from environmental inputs.</p></div></div>
          <div class="source-explainer"><b class="source-dot system"></b><div><strong>SYSTEM</strong><p>Routing, GPS, responder, and application-state updates.</p></div></div>
        </section>
        <section class="alerts-emergency-box">
          <span>NEED IMMEDIATE ASSISTANCE?</span>
          <strong>Request a responder</strong>
          <p>Your GPS position and current safety context can be attached to the SOS request.</p>
          <button type="button" data-alert-action="help">OPEN EMERGENCY HELP</button>
        </section>
      </aside>
    </div>
  `;

  section.querySelectorAll<HTMLButtonElement>('[data-alert-action="map"]').forEach((button) => {
    button.addEventListener('click', () => findNavButton('Live Map')?.click());
  });
  section.querySelectorAll<HTMLButtonElement>('[data-alert-action="help"]').forEach((button) => {
    button.addEventListener('click', () => findNavButton('Emergency Help')?.click());
  });

  lastRenderedLocation = location;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char] ?? char));
}

function maybeEnhanceAlerts() {
  const placeholder = document.querySelector<HTMLElement>('.figma-placeholder-panel');
  if (placeholder) {
    const heading = placeholder.querySelector('h2')?.textContent?.trim();
    if (heading === 'Alerts') renderAlertsScreen(placeholder);
    return;
  }

  const alertsScreen = document.querySelector<HTMLElement>('.citizen-alerts-screen');
  if (alertsScreen && currentLocationLabel() !== lastRenderedLocation) renderAlertsScreen(alertsScreen);
}

window.addEventListener('jalrakshak:route-analysis', (event) => {
  latestRoute = (event as CustomEvent<RouteAnalysisDetail>).detail;
  const screen = document.querySelector<HTMLElement>('.citizen-alerts-screen');
  if (screen) renderAlertsScreen(screen);
});

const observer = new MutationObserver(() => maybeEnhanceAlerts());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', maybeEnhanceAlerts);
window.addEventListener('load', maybeEnhanceAlerts);
maybeEnhanceAlerts();
