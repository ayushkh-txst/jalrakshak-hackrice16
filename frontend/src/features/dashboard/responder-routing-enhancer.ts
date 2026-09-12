import { citizenSafetyApi, type EmergencyRecord } from './api/citizen-safety.api';
import './responder-routing-enhancer.css';

type LatLng = { latitude: number; longitude: number };
type RouteCandidate = {
  distanceM: number;
  durationS: number;
  geometry: [number, number][];
  safetyScore: number;
  status: 'recommended' | 'viable' | 'rejected';
  reason: string;
};

let selectedIncidentId = '';
let responderPosition: LatLng | null = null;
let candidates: RouteCandidate[] = [];
let routing = false;
let lastRenderedKey = '';

const toRad = (v: number) => v * Math.PI / 180;
function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function selectedIdFromDom() {
  return document.querySelector<HTMLElement>('.ops-id-row > span')?.textContent?.trim() ?? '';
}

function fmtDistance(m: number) {
  return m >= 1609.344 ? `${(m / 1609.344).toFixed(1)} mi` : `${Math.max(1, Math.round(m * 3.28084))} ft`;
}
function fmtDuration(s: number) {
  const min = Math.max(1, Math.round(s / 60));
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;
}

function scoreRoutes(raw: Array<{ distanceM: number; durationS: number; geometry: [number, number][] }>, incident: EmergencyRecord): RouteCandidate[] {
  const risk = Number(incident.risk_score ?? 45);
  const minDistance = Math.min(...raw.map(r => r.distanceM));
  const minDuration = Math.min(...raw.map(r => r.durationS));

  const scored = raw.map((route) => {
    const distancePenalty = Math.min(22, ((route.distanceM - minDistance) / Math.max(minDistance, 1)) * 18);
    const timePenalty = Math.min(24, ((route.durationS - minDuration) / Math.max(minDuration, 1)) * 20);
    const incidentPenalty = risk >= 80 ? 8 : risk >= 60 ? 5 : 2;
    const safetyScore = Math.max(45, Math.round(96 - distancePenalty - timePenalty - incidentPenalty));
    return { ...route, safetyScore, status: 'viable' as const, reason: 'Road-route candidate passed prototype screening.' };
  }).sort((a, b) => b.safetyScore - a.safetyScore || a.durationS - b.durationS);

  return scored.map((r, index) => ({
    ...r,
    status: index === 0 ? 'recommended' : 'viable',
    reason: index === 0 ? 'Best balance of ETA, distance, and incident-risk context.' : 'Alternate road route available if conditions change.',
  }));
}

async function fetchRoutes(origin: LatLng, incident: EmergencyRecord): Promise<RouteCandidate[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5500);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${incident.longitude},${incident.latitude}?alternatives=true&steps=true&overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Routing service ${response.status}`);
    const data = await response.json() as { routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
    const raw = (data.routes ?? []).slice(0, 4).map(r => ({ distanceM: r.distance, durationS: r.duration, geometry: r.geometry?.coordinates ?? [] }));
    if (!raw.length) throw new Error('No road route returned');
    return scoreRoutes(raw, incident);
  } catch {
    const straight = haversineMeters(origin, { latitude: incident.latitude, longitude: incident.longitude });
    const estimate = Math.max(straight * 1.28, 300);
    return [{
      distanceM: estimate,
      durationS: estimate / 10.5,
      geometry: [[origin.longitude, origin.latitude], [incident.longitude, incident.latitude]],
      safetyScore: 62,
      status: 'recommended',
      reason: 'Fallback estimate only — live road routing is temporarily unavailable.',
    }];
  } finally {
    window.clearTimeout(timer);
  }
}

function svgRoute(route: RouteCandidate | undefined, origin: LatLng | null, incident: EmergencyRecord | null) {
  if (!route || !origin || !incident) return '<div class="response-route-empty-map">Route preview appears after responder GPS is enabled.</div>';
  const points = route.geometry.length > 1 ? route.geometry : [[origin.longitude, origin.latitude], [incident.longitude, incident.latitude]] as [number, number][];
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, .0001), spanY = Math.max(maxY - minY, .0001);
  const projected = points.map(([x,y]) => `${20 + ((x-minX)/spanX)*360},${180 - ((y-minY)/spanY)*140}`).join(' ');
  return `<svg viewBox="0 0 400 200" class="response-route-svg" aria-label="Responder route preview"><rect x="0" y="0" width="400" height="200" rx="14"/><polyline points="${projected}"/><circle cx="20" cy="180" r="8" class="route-origin"/><circle cx="380" cy="40" r="9" class="route-destination"/><text x="34" y="184">Responder</text><text x="292" y="30">Citizen SOS</text></svg>`;
}

async function useResponderLocation() {
  const status = document.querySelector<HTMLElement>('[data-response-route-status]');
  if (!navigator.geolocation) {
    if (status) status.textContent = 'Responder GPS is not supported by this browser.';
    return;
  }
  if (status) status.textContent = 'Locating responder…';
  navigator.geolocation.getCurrentPosition(async (position) => {
    responderPosition = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    if (status) status.textContent = `Responder GPS locked · ±${Math.round(position.coords.accuracy)} m`;
    await calculateRoute();
  }, (error) => {
    if (status) status.textContent = error.code === error.PERMISSION_DENIED ? 'Location permission denied. Enable browser location to calculate rescue routes.' : 'Unable to get responder GPS.';
  }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 3000 });
}

async function calculateRoute() {
  if (routing || !responderPosition || !selectedIncidentId) return;
  routing = true;
  const status = document.querySelector<HTMLElement>('[data-response-route-status]');
  if (status) status.textContent = 'Analyzing responder → citizen road routes…';
  try {
    const incident = await citizenSafetyApi.getEmergency(selectedIncidentId);
    candidates = await fetchRoutes(responderPosition, incident);
    if (status) status.textContent = `${candidates.length} route${candidates.length === 1 ? '' : 's'} analyzed · safest viable route recommended`;
    await render(true);
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : 'Unable to calculate route.';
  } finally { routing = false; }
}

async function startGuidance() {
  if (!selectedIncidentId) return;
  const incident = await citizenSafetyApi.getEmergency(selectedIncidentId);
  if (incident.status === 'assigned') await citizenSafetyApi.updateEmergency(incident.id, { status: 'en_route', responder_id: incident.responder_id ?? undefined, responder_name: incident.responder_name ?? undefined });
  const recommended = candidates.find(r => r.status === 'recommended');
  if (responderPosition && recommended) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${responderPosition.latitude},${responderPosition.longitude}&destination=${incident.latitude},${incident.longitude}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  const status = document.querySelector<HTMLElement>('[data-response-route-status]');
  if (status) status.textContent = 'Guidance started · incident marked EN ROUTE. Recheck route if conditions change.';
}

async function render(force = false) {
  const host = document.querySelector<HTMLElement>('.ops-detail-pane');
  const id = selectedIdFromDom();
  if (!host || !id) {
    document.querySelector('[data-responder-routing]')?.remove();
    return;
  }
  if (id !== selectedIncidentId) {
    selectedIncidentId = id;
    candidates = [];
  }
  let incident: EmergencyRecord | null = null;
  try { incident = await citizenSafetyApi.getEmergency(id); } catch { return; }
  const recommended = candidates.find(r => r.status === 'recommended');
  const key = `${id}|${incident.status}|${responderPosition?.latitude.toFixed(4) ?? ''}|${candidates.length}|${recommended?.distanceM ?? 0}`;
  if (!force && key === lastRenderedKey && host.querySelector('[data-responder-routing]')) return;
  lastRenderedKey = key;

  let panel = host.querySelector<HTMLElement>('[data-responder-routing]');
  if (!panel) {
    panel = document.createElement('section');
    panel.dataset.responderRouting = 'true';
    panel.className = 'responder-routing-panel';
    const timeline = host.querySelector('.ops-main-grid');
    timeline?.insertAdjacentElement('beforebegin', panel);
  }
  if (!panel) return;

  const mapUrl = responderPosition ? `https://www.google.com/maps/dir/?api=1&origin=${responderPosition.latitude},${responderPosition.longitude}&destination=${incident.latitude},${incident.longitude}&travelmode=driving` : '';
  panel.innerHTML = `
    <div class="response-route-head"><div><span>RESPONDER → CITIZEN ROUTING</span><h3>Safest response route</h3><p data-response-route-status>${responderPosition ? (candidates.length ? `${candidates.length} route${candidates.length === 1 ? '' : 's'} analyzed · safest viable route recommended` : 'Responder GPS ready · calculate road routes') : 'Use responder GPS to calculate live road routes to this SOS.'}</p></div><b>${incident.status.replace('_',' ').toUpperCase()}</b></div>
    <div class="response-route-grid">
      <div class="response-route-map">${svgRoute(recommended, responderPosition, incident)}</div>
      <div class="response-route-info">
        <div class="response-route-points"><div><span>RESPONDER</span><strong>${responderPosition ? `${responderPosition.latitude.toFixed(5)}, ${responderPosition.longitude.toFixed(5)}` : 'GPS not enabled'}</strong></div><div><span>CITIZEN SOS</span><strong>${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}</strong></div></div>
        ${recommended ? `<div class="response-route-metrics"><div><span>ETA</span><strong>${fmtDuration(recommended.durationS)}</strong></div><div><span>DISTANCE</span><strong>${fmtDistance(recommended.distanceM)}</strong></div><div><span>SAFETY</span><strong>${recommended.safetyScore}/100</strong></div><div><span>ROUTES</span><strong>${candidates.length}</strong></div></div><p class="response-route-reason">✓ ${recommended.reason}</p>` : '<div class="response-route-await">No route calculated yet.</div>'}
        <div class="response-route-actions"><button type="button" data-use-responder-location>${responderPosition ? 'REFRESH GPS + ROUTE' : 'USE RESPONDER GPS'}</button>${recommended ? `<button type="button" class="primary" data-start-response-guidance ${incident.status === 'resolved' || incident.status === 'cancelled' ? 'disabled' : ''}>START GUIDANCE</button><a href="${mapUrl}" target="_blank" rel="noreferrer">OPEN IN GOOGLE MAPS ↗</a>` : ''}</div>
      </div>
    </div>
    ${candidates.length > 1 ? `<div class="response-route-alternatives"><span>ROUTE ANALYSIS</span>${candidates.map((r,i)=>`<div class="${r.status}"><b>${r.status === 'recommended' ? '✓ RECOMMENDED' : `ALT ${i+1}`}</b><strong>${fmtDuration(r.durationS)} · ${fmtDistance(r.distanceM)}</strong><em>${r.safetyScore}/100</em></div>`).join('')}</div>` : ''}
  `;
  panel.querySelector<HTMLButtonElement>('[data-use-responder-location]')?.addEventListener('click', () => void useResponderLocation());
  panel.querySelector<HTMLButtonElement>('[data-start-response-guidance]')?.addEventListener('click', () => void startGuidance());
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(() => { scheduled = false; void render(); }, 120);
}

const observer = new MutationObserver(scheduleRender);
const start = () => { observer.observe(document.body, { childList: true, subtree: true, characterData: true }); scheduleRender(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
