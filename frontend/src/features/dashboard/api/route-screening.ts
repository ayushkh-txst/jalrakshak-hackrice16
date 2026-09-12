import type { EvacuationRoute, ScreenedRoute } from './citizen-safety.api';

type LatLon = [number, number];
type HazardSeverity = 'high' | 'critical';
type HazardPolygon = { id: string; severity: HazardSeverity; label: string; points: LatLon[] };
type UserHazardKind = 'road_blocked' | 'flooded_road' | 'debris' | 'other';
type UserHazardReport = {
  id: string;
  kind: UserHazardKind;
  label: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  created_at: string;
  source: 'user_reported';
};
type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  maneuver?: { instruction?: string; type?: string; modifier?: string };
};
type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs?: Array<{ steps?: OsrmStep[] }>;
};

type CandidateResult = ScreenedRoute & { routeSteps: EvacuationRoute['steps'] };

const NEPAL_DEMO_CENTER: LatLon = [27.9516, 85.6846];
const MAX_SCREENING_MS = 2600;
const USER_REPORTS_KEY = 'jalrakshak:user-hazard-reports:v1';
const USER_REPORT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const DEMO_HAZARDS: HazardPolygon[] = [
  {
    id: 'critical-demo-1',
    severity: 'critical',
    label: 'Critical modeled flood zone',
    points: [[27.9462,85.6740],[27.9530,85.6748],[27.9552,85.6804],[27.9526,85.6840],[27.9474,85.6830],[27.9448,85.6780]],
  },
  {
    id: 'high-demo-1',
    severity: 'high',
    label: 'High modeled flood-risk zone',
    points: [[27.9550,85.6892],[27.9615,85.6900],[27.9630,85.6992],[27.9583,85.7020],[27.9535,85.6960]],
  },
];

const nearNepalDemo = (lat: number, lon: number) => Math.abs(lat - NEPAL_DEMO_CENTER[0]) < 0.5 && Math.abs(lon - NEPAL_DEMO_CENTER[1]) < 0.5;

function loadRecentUserHazards(): UserHazardReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(USER_REPORTS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const cutoff = Date.now() - USER_REPORT_MAX_AGE_MS;
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

function pointInPolygon(point: LatLon, polygon: LatLon[]): boolean {
  const [lat, lon] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const intersects = ((lonI > lon) !== (lonJ > lon)) &&
      (lat < ((latJ - latI) * (lon - lonI)) / ((lonJ - lonI) || Number.EPSILON) + latI);
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a: LatLon, b: LatLon, c: LatLon): number {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function segmentsIntersect(a: LatLon, b: LatLon, c: LatLon, d: LatLon): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return (o1 === 0 || o2 === 0 || o1 * o2 < 0) && (o3 === 0 || o4 === 0 || o3 * o4 < 0);
}

function routeIntersectsPolygon(route: LatLon[], polygon: LatLon[]): boolean {
  if (route.some(point => pointInPolygon(point, polygon))) return true;
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1];
    const b = route[i];
    for (let j = 0; j < polygon.length; j += 1) {
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function distanceMeters(a: LatLon, b: LatLon): number {
  const earth = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const lat1 = a[0] * rad;
  const lat2 = b[0] * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function reportRadiusMeters(report: UserHazardReport): number {
  const base = report.kind === 'flooded_road' ? 110 : report.kind === 'road_blocked' ? 85 : report.kind === 'debris' ? 60 : 55;
  const accuracy = Number.isFinite(report.accuracy_m) ? Math.max(0, Number(report.accuracy_m)) : 0;
  return Math.min(180, base + Math.min(accuracy, 50));
}

function routeNearUserReport(route: LatLon[], report: UserHazardReport): boolean {
  const point: LatLon = [report.latitude, report.longitude];
  const radius = reportRadiusMeters(report);
  return route.some(routePoint => distanceMeters(routePoint, point) <= radius);
}

async function fetchAlternatives(originLat: number, originLon: number, route: EvacuationRoute): Promise<OsrmRoute[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MAX_SCREENING_MS);
  try {
    const coords = `${originLon},${originLat};${route.destination_longitude},${route.destination_latitude}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?alternatives=true&overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('OSRM alternative-route lookup failed');
    const payload = await response.json() as { routes?: OsrmRoute[] };
    return payload.routes ?? [];
  } finally {
    window.clearTimeout(timer);
  }
}

function geometryToLatLon(route: OsrmRoute): LatLon[] {
  return route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

function instructionForStep(step: OsrmStep, index: number): string {
  const provided = step.maneuver?.instruction?.trim();
  if (provided) return provided;
  const name = step.name?.trim();
  const type = step.maneuver?.type?.replace(/_/g, ' ').trim();
  const modifier = step.maneuver?.modifier?.replace(/_/g, ' ').trim();
  const pieces = [type, modifier, name ? `onto ${name}` : ''].filter(Boolean);
  return pieces.length ? pieces.join(' ') : `Continue on the recommended route (${index + 1})`;
}

function routeSteps(route: OsrmRoute): EvacuationRoute['steps'] {
  const steps = route.legs?.flatMap(leg => leg.steps ?? []) ?? [];
  return steps
    .filter(step => step.distance > 1 || step.duration > 1)
    .map((step, index) => ({
      instruction: instructionForStep(step, index),
      distance_m: step.distance,
      duration_s: step.duration,
    }));
}

function screenCandidate(route: OsrmRoute, hazards: HazardPolygon[], userReports: UserHazardReport[], index: number): CandidateResult {
  const geometry = geometryToLatLon(route);
  const rejectionReasons: string[] = [];
  let highRiskTouches = 0;

  for (const hazard of hazards) {
    if (!routeIntersectsPolygon(geometry, hazard.points)) continue;
    if (hazard.severity === 'critical') rejectionReasons.push(`Crosses ${hazard.label.toLowerCase()}`);
    else highRiskTouches += 1;
  }

  for (const report of userReports) {
    if (!routeNearUserReport(geometry, report)) continue;
    rejectionReasons.push(`Passes near user-reported ${report.label.toLowerCase()} (${report.id})`);
  }

  const status: ScreenedRoute['status'] = rejectionReasons.length ? 'rejected' : 'viable';
  const safetyPenalty = rejectionReasons.length * 70 + highRiskTouches * 18;
  return {
    id: `candidate-${index + 1}`,
    status,
    distance_m: route.distance,
    duration_s: route.duration,
    prototype_safety_score: Math.max(5, 100 - safetyPenalty),
    rejection_reasons: rejectionReasons,
    geometry,
    routeSteps: routeSteps(route),
  };
}

export async function screenEvacuationRoute(originLat: number, originLon: number, route: EvacuationRoute): Promise<EvacuationRoute> {
  try {
    const osrmRoutes = await fetchAlternatives(originLat, originLon, route);
    if (!osrmRoutes.length) return route;

    const hazards = nearNepalDemo(originLat, originLon) ? DEMO_HAZARDS : [];
    const userReports = loadRecentUserHazards();
    const screened = osrmRoutes.map((candidate, index) => screenCandidate(candidate, hazards, userReports, index));

    const viable = screened.filter(candidate => candidate.status === 'viable');
    const rejected = screened.filter(candidate => candidate.status === 'rejected');

    let recommended: CandidateResult | null = null;
    if (viable.length) {
      recommended = viable.reduce((best, candidate) => {
        const bestScore = (best.prototype_safety_score ?? 0) * 100000 - (best.duration_s ?? Number.MAX_SAFE_INTEGER);
        const candidateScore = (candidate.prototype_safety_score ?? 0) * 100000 - (candidate.duration_s ?? Number.MAX_SAFE_INTEGER);
        return candidateScore > bestScore ? candidate : best;
      }) as CandidateResult;
      recommended.status = 'recommended';
    }

    const userReportReason = userReports.length
      ? `Also screened against ${userReports.length} recent user-reported hazard${userReports.length === 1 ? '' : 's'} from the last 6 hours. These reports are unverified and are used conservatively to avoid nearby road segments.`
      : 'No recent user-reported road hazards are stored on this device.';

    if (!recommended) {
      return {
        ...route,
        alternatives_considered: screened.length,
        rejected_count: rejected.length,
        viable_count: 0,
        recommended_count: 0,
        screening_status: 'complete',
        screened_routes: screened,
        reasons: [
          ...route.reasons,
          `All ${screened.length} available road alternatives were rejected by the current prototype safety screen.`,
          userReportReason,
        ],
        warning: 'No route is currently recommended. User reports are not official closures, and modeled hazards are prototype data. Do not claim a road is safe when every candidate is rejected.',
      };
    }

    const recommendedSteps = recommended.routeSteps.length ? recommended.routeSteps : route.steps;
    return {
      ...route,
      geometry: recommended.geometry ?? route.geometry,
      distance_m: recommended.distance_m ?? route.distance_m,
      duration_s: recommended.duration_s ?? route.duration_s,
      steps: recommendedSteps,
      prototype_safety_score: recommended.prototype_safety_score ?? route.prototype_safety_score,
      alternatives_considered: screened.length,
      rejected_count: rejected.length,
      viable_count: viable.length,
      recommended_count: 1,
      screening_status: 'complete',
      screened_routes: screened,
      reasons: [
        ...route.reasons,
        hazards.length
          ? `Screened ${screened.length} road alternatives against configured modeled hazard polygons.`
          : `Screened ${screened.length} real road alternatives for the current location.`,
        userReportReason,
        rejected.length
          ? `${rejected.length} route${rejected.length === 1 ? ' was' : 's were'} rejected; the safest remaining viable alternative is now the recommended route.`
          : 'No candidate route intersected the currently configured hazard exclusions.',
      ],
      warning: userReports.length
        ? 'Route screening includes recent user-reported hazards. Those reports are not official road-closure confirmations, so the route remains a prototype safety recommendation.'
        : hazards.length
          ? 'Route rejection uses modeled prototype hazard polygons and should not be treated as an official road-closure or flood-depth determination.'
          : 'Road alternatives are real OSRM routes, but no official flood/closure geometry is configured for this location. Screening therefore cannot claim a road is flood-safe.',
    };
  } catch {
    return {
      ...route,
      screening_status: route.screening_status ?? 'pending',
    };
  }
}
