type HazardKind = 'road_blocked' | 'flooded_road' | 'debris' | 'other';
type UserHazardReport = {
  id: string;
  kind: HazardKind;
  label: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  created_at: string;
  source: 'user_reported';
};

type LeafletLike = {
  map: (...args: any[]) => any;
  layerGroup: (...args: any[]) => any;
  marker: (...args: any[]) => any;
  circle: (...args: any[]) => any;
  divIcon: (...args: any[]) => any;
};

const REPORTS_KEY = 'jalrakshak:user-hazard-reports:v1';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const PATCH_FLAG = '__jalrakshakUserHazardPatched';
const maps = new Set<any>();
const reportLayers = new WeakMap<any, any>();
let installTimer: number | null = null;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function readReports(): UserHazardReport[] {
  try {
    const raw = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return raw.filter((item: any): item is UserHazardReport => {
      if (!item || item.source !== 'user_reported') return false;
      if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return false;
      const created = Date.parse(item.created_at ?? '');
      return Number.isFinite(created) && created >= cutoff;
    });
  } catch {
    return [];
  }
}

function ageLabel(value: string) {
  const age = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
}

function markerGlyph(kind: HazardKind) {
  if (kind === 'flooded_road') return '≈';
  if (kind === 'debris') return '◆';
  if (kind === 'road_blocked') return '×';
  return '!';
}

function reportRadius(report: UserHazardReport) {
  const base = report.kind === 'flooded_road' ? 110 : report.kind === 'road_blocked' ? 85 : report.kind === 'debris' ? 60 : 55;
  const accuracy = Number.isFinite(report.accuracy_m) ? Math.max(0, Number(report.accuracy_m)) : 0;
  return Math.min(180, base + Math.min(accuracy, 50));
}

function renderReportsOnMap(map: any, L: LeafletLike) {
  if (!map || !L?.layerGroup) return;
  const old = reportLayers.get(map);
  if (old) {
    try { map.removeLayer(old); } catch {}
  }

  const group = L.layerGroup().addTo(map);
  reportLayers.set(map, group);

  for (const report of readReports()) {
    const radius = reportRadius(report);
    const accuracy = report.accuracy_m == null ? 'GPS accuracy unavailable' : `GPS accuracy ±${Math.round(report.accuracy_m)} m`;
    const icon = L.divIcon({
      className: 'jalrakshak-user-hazard-marker',
      html: `<span>${markerGlyph(report.kind)}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([report.latitude, report.longitude], { icon }).addTo(group);
    L.circle([report.latitude, report.longitude], {
      radius,
      color: '#b63a32',
      weight: 2,
      opacity: .8,
      fillColor: '#c94a40',
      fillOpacity: .12,
      dashArray: '6 6',
      interactive: false,
    }).addTo(group);
    marker.bindPopup(`
      <div class="user-hazard-popup">
        <strong>USER REPORTED</strong>
        <b>${escapeHtml(report.label)}</b>
        <span>${escapeHtml(report.id)} · ${ageLabel(report.created_at)}</span>
        <span>${escapeHtml(accuracy)}</span>
        <small>Unverified report. JalRakshak uses it conservatively during prototype route screening.</small>
      </div>
    `);
  }
}

function refreshAllMaps() {
  const L = (window as any).L as LeafletLike | undefined;
  if (!L) return;
  maps.forEach((map) => renderReportsOnMap(map, L));
}

function patchLeaflet() {
  const browser = window as any;
  const L = browser.L as (LeafletLike & Record<string, any>) | undefined;
  if (!L?.map || L[PATCH_FLAG]) return Boolean(L?.map);

  const originalMap = L.map.bind(L);
  L.map = (...args: any[]) => {
    const map = originalMap(...args);
    maps.add(map);
    const originalRemove = typeof map.remove === 'function' ? map.remove.bind(map) : null;
    if (originalRemove) {
      map.remove = (...removeArgs: any[]) => {
        maps.delete(map);
        reportLayers.delete(map);
        return originalRemove(...removeArgs);
      };
    }
    window.setTimeout(() => renderReportsOnMap(map, L), 0);
    return map;
  };
  L[PATCH_FLAG] = true;
  return true;
}

function watchLeafletScript() {
  document.querySelectorAll<HTMLScriptElement>('script[data-jalrakshak-leaflet]').forEach((script) => {
    if (script.dataset.userHazardHooked) return;
    script.dataset.userHazardHooked = 'true';
    script.addEventListener('load', () => patchLeaflet(), { once: true });
  });
}

function install() {
  watchLeafletScript();
  if (patchLeaflet()) {
    if (installTimer != null) window.clearInterval(installTimer);
    installTimer = null;
  }
}

window.addEventListener('jalrakshak:user-hazard-report', refreshAllMaps);
window.addEventListener('storage', (event) => { if (event.key === REPORTS_KEY) refreshAllMaps(); });

const observer = new MutationObserver(install);
observer.observe(document.documentElement, { childList: true, subtree: true });
install();
installTimer = window.setInterval(install, 100);
window.setTimeout(() => {
  if (installTimer != null) window.clearInterval(installTimer);
  installTimer = null;
}, 12_000);
