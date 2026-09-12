import type { EvacuationRoute, ScreenedRoute } from './citizen-safety.api';

type LatLon = [number, number];
type HazardSeverity = 'high' | 'critical';
type HazardPolygon = { id: string; severity: HazardSeverity; label: string; points: LatLon[] };
type OsrmRoute = { distance: number; duration: number; geometry: { coordinates: [number, number][] } };

const NEPAL_DEMO_CENTER: LatLon = [27.9516, 85.6846];
const MAX_SCREENING_MS = 2600;

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

async function fetchAlternatives(originLat: number, originLon: number, route: EvacuationRoute): Promise<OsrmRoute[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MAX_SCREENING_MS);
  try {
    const coords = `${originLon},${originLat};${route.destination_longitude},${route.destination_latitude}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?alternatives=true&overview=full&geometries=geojson&steps=false`;
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

function screenCandidate(route: OsrmRoute, hazards: HazardPolygon[], index: number): ScreenedRoute {
  const geometry = geometryToLatLon(route);
  const rejectionReasons: string[] = [];
  let highRiskTouches = 0;

  for (const hazard of hazards) {
    if (!routeIntersectsPolygon(geometry, hazard.points)) continue;
    if (hazard.severity === 'critical') rejectionReasons.push(`Crosses ${hazard.label.toLowerCase()}`);
    else highRiskTouches += 1;
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
  };
}

export async function screenEvacuationRoute(originLat: number, originLon: number, route: EvacuationRoute): Promise<EvacuationRoute> {
  try {
    const osrmRoutes = await fetchAlternatives(originLat, originLon, route);
    if (!osrmRoutes.length) return route;

    const hazards = nearNepalDemo(originLat, originLon) ? DEMO_HAZARDS : [];
    const screened = osrmRoutes.map((candidate, index) => screenCandidate(candidate, hazards, index));

    const viable = screened.filter(candidate => candidate.status === 'viable');
    const rejected = screened.filter(candidate => candidate.status === 'rejected');

    if (viable.length) {
      const recommended = viable.reduce((best, candidate) => {
        const bestScore = (best.prototype_safety_score ?? 0) * 100000 - (best.duration_s ?? Number.MAX_SAFE_INTEGER);
        const candidateScore = (candidate.prototype_safety_score ?? 0) * 100000 - (candidate.duration_s ?? Number.MAX_SAFE_INTEGER);
        return candidateScore > bestScore ? candidate : best;
      });
      recommended.status = 'recommended';
    }

    return {
      ...route,
      alternatives_considered: screened.length,
      rejected_count: rejected.length,
      viable_count: viable.length,
      recommended_count: viable.length ? 1 : 0,
      screening_status: 'complete',
      screened_routes: screened,
      reasons: [
        ...route.reasons,
        hazards.length
          ? `Screened ${screened.length} road alternatives against configured modeled hazard polygons.`
          : `Screened ${screened.length} road alternatives. No mapped hazard polygons are configured for this location yet, so none were rejected for flood intersection.`,
      ],
      warning: hazards.length
        ? 'Route rejection uses modeled prototype hazard polygons and should not be treated as an official road-closure or flood-depth determination.'
        : 'Road alternatives are real OSRM routes, but flood/closure geometry is not yet configured for this location. Screening therefore cannot claim a road is flood-safe.',
    };
  } catch {
    return {
      ...route,
      screening_status: route.screening_status ?? 'pending',
    };
  }
}
