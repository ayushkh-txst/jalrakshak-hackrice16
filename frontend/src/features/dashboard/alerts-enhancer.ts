type RouteAnalysisDetail = {
  alternatives_considered?: number;
  rejected_count?: number;
  viable_count?: number;
  screening_status?: 'pending' | 'complete';
  prototype_safety_score?: number;
  warning?: string;
};

type AlertCategory = 'critical' | 'route' | 'responder' | 'system';

let latestRoute: RouteAnalysisDetail | null = null;
let lastRenderedLocation = '';
let activeCategory: AlertCategory = 'critical';

function findNavButton(label: string): HTMLButtonElement | null {
  return [...document.querySelectorAll<HTMLButtonElement>('.figma-nav button')]
    .find((button) => button.textContent?.trim().includes(label)) ?? null;
}

function currentLocationLabel(): string {
  const topbar = document.querySelector<HTMLElement>('.location-line');
  const raw = topbar?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!raw || raw.includes('Bagmati Valley, Sindhupalchowk')) return 'Bagmati Valley';
  return raw.replace(/^⌖\s*/, '').replace(/\s*·\s*LIVE\s*$/, '').trim();
}

function scoreText(): string {
  const score = latestRoute?.prototype_safety_score;
  return typeof score === 'number' ? `${score}/100` : '87/100';
}

function renderTabs() {
  const routeCount = latestRoute?.alternatives_considered ? 1 : 1;
  return `
    <div class="figma-alert-tabs" role="tablist" aria-label="Alert categories">
      <button type="button" data-alert-tab="critical" class="${activeCategory === 'critical' ? 'active' : ''}">Critical Alerts <b>2</b></button>
      <button type="button" data-alert-tab="route" class="${activeCategory === 'route' ? 'active' : ''}">Route Updates <b>${routeCount}</b></button>
      <button type="button" data-alert-tab="responder" class="${activeCategory === 'responder' ? 'active' : ''}">Responder Updates</button>
      <button type="button" data-alert-tab="system" class="${activeCategory === 'system' ? 'active' : ''}">System Notices <b>3</b></button>
    </div>
  `;
}

function criticalAlerts(location: string) {
  return `
    <div class="figma-alert-feed">
      <article class="figma-feed-card critical">
        <div class="feed-card-heading"><span><i></i> CRITICAL FLOOD WARNING</span><time>Just now</time></div>
        <p>${escapeHtml(location)} flood risk has reached CRITICAL (${scoreText()}). Begin evacuation immediately.</p>
      </article>
      <article class="figma-feed-card rising">
        <div class="feed-card-heading"><span><i></i> RISING WATER LEVEL ALERT</span><time>4 min ago</time></div>
        <p>Water levels are rising rapidly in the monitored area. Prepare to move toward your safest available evacuation route.</p>
      </article>
    </div>
  `;
}

function routeUpdates() {
  const analyzed = latestRoute?.alternatives_considered ?? 0;
  const rejected = latestRoute?.rejected_count;
  const viable = latestRoute?.viable_count;
  const screeningComplete = latestRoute?.screening_status === 'complete';
  const message = analyzed
    ? screeningComplete && typeof rejected === 'number' && typeof viable === 'number'
      ? `JalRakshak analyzed ${analyzed} route option${analyzed === 1 ? '' : 's'}: ${rejected} rejected and ${viable} viable. Your recommended route remains active.`
      : `JalRakshak analyzed ${analyzed} route option${analyzed === 1 ? '' : 's'}. Hazard screening is still limited for this location.`
    : 'Use your location on the Live Map to calculate and compare road routes.';

  return `
    <div class="figma-alert-feed">
      <article class="figma-feed-card route-update">
        <div class="feed-card-heading"><span><i></i> ROUTE UPDATE — SAFEST AVAILABLE PATH</span><time>Live</time></div>
        <p>${escapeHtml(message)}</p>
        <button type="button" class="feed-inline-action" data-alert-action="map">View route</button>
      </article>
    </div>
  `;
}

function responderUpdates() {
  return `
    <div class="figma-empty-category">
      <div class="empty-check">✓</div>
      <p>No updates in this category</p>
    </div>
  `;
}

function systemNotices() {
  return `
    <div class="figma-alert-feed system-feed">
      <article class="figma-feed-card system-neutral">
        <div class="feed-card-heading"><span><i></i> LOCATION PERMISSION ACTIVE</span><time>Live</time></div>
        <p>JalRakshak can use your device location for route, risk, and responder accuracy when permission is enabled.</p>
      </article>
      <article class="figma-feed-card system-warning">
        <div class="feed-card-heading"><span><i></i> ROUTE CACHE READY</span><time>Current session</time></div>
        <p>Recent route data can remain visible if a live routing service is temporarily slow.</p>
      </article>
      <article class="figma-feed-card system-neutral">
        <div class="feed-card-heading"><span><i></i> APPLICATION STATUS</span><time>Now</time></div>
        <p>Live map, SOS tracking, routing, and responder workflow modules are connected for this prototype.</p>
      </article>
    </div>
  `;
}

function categoryContent(location: string) {
  if (activeCategory === 'route') return routeUpdates();
  if (activeCategory === 'responder') return responderUpdates();
  if (activeCategory === 'system') return systemNotices();
  return criticalAlerts(location);
}

function renderAlertsScreen(section: HTMLElement) {
  const location = currentLocationLabel();
  section.className = 'citizen-alerts-screen figma-alerts-screen';
  section.innerHTML = `
    <div class="figma-alerts-shell">
      ${renderTabs()}
      <div class="figma-alert-category-body" role="tabpanel">
        ${categoryContent(location)}
      </div>
    </div>
  `;

  section.querySelectorAll<HTMLButtonElement>('[data-alert-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.alertTab as AlertCategory;
      renderAlertsScreen(section);
    });
  });

  section.querySelectorAll<HTMLButtonElement>('[data-alert-action="map"]').forEach((button) => {
    button.addEventListener('click', () => findNavButton('Live Map')?.click());
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
