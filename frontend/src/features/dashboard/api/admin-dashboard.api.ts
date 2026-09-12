import { apiRequest } from '../../../lib/api-client';
import { citizenSafetyApi, type EmergencyRecord } from './citizen-safety.api';

export type RiskBand = 'low' | 'moderate' | 'high' | 'critical';
export type DistrictId = 'sindhupalchok' | 'rautahat' | 'chitwan' | 'kathmandu';

export type DistrictSummary = {
  id: DistrictId;
  name: string;
  riskScore: number;
  riskBand: RiskBand;
  incidentCount: number;
  peopleAtRisk: number;
  activeResponders: number;
  safeZoneLoad: number;
  center: { lat: number; lng: number };
};

export type DistrictIncident = {
  id: string;
  type: 'rescue' | 'medical' | 'evacuation';
  priority: RiskBand;
  people: number;
  risk: number;
  ageLabel: string;
  accuracyLabel: string;
  status: string;
  latitude: number;
  longitude: number;
};

export type SafeZone = {
  id: string;
  name: string;
  distanceLabel: string;
  occupancy: number;
  capacity: number;
  status: 'recommended' | 'near_capacity' | 'available';
};

export type ResponderStatus = {
  id: string;
  name: string;
  status: 'available' | 'assigned' | 'en_route';
  incidentId?: string;
};

export type DistrictOperations = DistrictSummary & {
  factors: Array<{ label: string; value: number }>;
  incidents: DistrictIncident[];
  safeZones: SafeZone[];
  responders: ResponderStatus[];
};

export type AdminDashboardOverview = {
  source: 'live' | 'hybrid';
  updatedAt: string;
  criticalDistricts: number;
  activeIncidents: number;
  peopleAtRisk: number;
  activeResponders: number;
  districts: DistrictSummary[];
  riskTrend: Array<{ label: string; value: number }>;
  safeZoneCapacity: { total: number; assigned: number; available: number; loadPercent: number };
};

const HYBRID_DISTRICTS: Record<DistrictId, DistrictOperations> = {
  sindhupalchok: {
    id: 'sindhupalchok', name: 'Sindhupalchok', riskScore: 91, riskBand: 'critical', incidentCount: 6, peopleAtRisk: 547, activeResponders: 14, safeZoneLoad: 61,
    center: { lat: 27.9512, lng: 85.6846 },
    factors: [{ label: 'Forecast rainfall', value: 91 }, { label: 'River rise', value: 88 }, { label: 'Recent rainfall', value: 76 }, { label: 'Terrain exposure', value: 72 }],
    incidents: [
      { id: '#1042', type: 'rescue', priority: 'critical', people: 3, risk: 91, ageLabel: '22 sec', accuracyLabel: '±11m', status: 'submitted', latitude: 27.955, longitude: 85.681 },
      { id: '#1048', type: 'medical', priority: 'high', people: 1, risk: 84, ageLabel: '1 min', accuracyLabel: '±18m', status: 'assigned', latitude: 27.948, longitude: 85.676 },
      { id: '#1051', type: 'evacuation', priority: 'high', people: 5, risk: 78, ageLabel: '36 sec', accuracyLabel: '±14m', status: 'en_route', latitude: 27.944, longitude: 85.689 },
    ],
    safeZones: [
      { id: 'sz-s1', name: 'Shree Secondary School', distanceLabel: '920 m', occupancy: 244, capacity: 400, status: 'recommended' },
      { id: 'sz-s2', name: 'Community Hall B', distanceLabel: '710 m', occupancy: 235, capacity: 250, status: 'near_capacity' },
      { id: 'sz-s3', name: 'High Ground Sector C', distanceLabel: '1.2 km', occupancy: 190, capacity: 500, status: 'available' },
    ],
    responders: [
      { id: 'r1', name: 'Amit Kumar', status: 'en_route', incidentId: '#1042' }, { id: 'r2', name: 'Sita Rai', status: 'available' }, { id: 'r3', name: 'Ram Shrestha', status: 'assigned', incidentId: '#1048' }, { id: 'r4', name: 'Priya Tamang', status: 'en_route', incidentId: '#1051' }, { id: 'r5', name: 'Dev Karki', status: 'available' },
    ],
  },
  rautahat: {
    id: 'rautahat', name: 'Rautahat', riskScore: 84, riskBand: 'high', incidentCount: 4, peopleAtRisk: 312, activeResponders: 9, safeZoneLoad: 72,
    center: { lat: 26.7643, lng: 85.2764 },
    factors: [{ label: 'Forecast rainfall', value: 84 }, { label: 'River rise', value: 79 }, { label: 'Recent rainfall', value: 71 }, { label: 'Terrain exposure', value: 53 }],
    incidents: [{ id: '#2031', type: 'evacuation', priority: 'high', people: 8, risk: 84, ageLabel: '48 sec', accuracyLabel: '±15m', status: 'submitted', latitude: 26.766, longitude: 85.279 }],
    safeZones: [{ id: 'sz-r1', name: 'District School Shelter', distanceLabel: '1.1 km', occupancy: 320, capacity: 450, status: 'recommended' }, { id: 'sz-r2', name: 'Municipal Hall', distanceLabel: '1.6 km', occupancy: 180, capacity: 220, status: 'near_capacity' }],
    responders: [{ id: 'rr1', name: 'Nabin Shah', status: 'en_route', incidentId: '#2031' }, { id: 'rr2', name: 'Maya Yadav', status: 'available' }],
  },
  chitwan: {
    id: 'chitwan', name: 'Chitwan', riskScore: 78, riskBand: 'high', incidentCount: 3, peopleAtRisk: 241, activeResponders: 7, safeZoneLoad: 49,
    center: { lat: 27.5291, lng: 84.3542 },
    factors: [{ label: 'Forecast rainfall', value: 78 }, { label: 'River rise', value: 74 }, { label: 'Recent rainfall', value: 68 }, { label: 'Terrain exposure', value: 47 }],
    incidents: [{ id: '#3014', type: 'medical', priority: 'high', people: 2, risk: 78, ageLabel: '2 min', accuracyLabel: '±20m', status: 'assigned', latitude: 27.531, longitude: 84.352 }],
    safeZones: [{ id: 'sz-c1', name: 'Bharatpur School Shelter', distanceLabel: '850 m', occupancy: 185, capacity: 500, status: 'recommended' }],
    responders: [{ id: 'rc1', name: 'Anil Gurung', status: 'assigned', incidentId: '#3014' }, { id: 'rc2', name: 'Rekha Lama', status: 'available' }],
  },
  kathmandu: {
    id: 'kathmandu', name: 'Kathmandu', riskScore: 58, riskBand: 'moderate', incidentCount: 2, peopleAtRisk: 147, activeResponders: 4, safeZoneLoad: 33,
    center: { lat: 27.7172, lng: 85.3240 },
    factors: [{ label: 'Forecast rainfall', value: 58 }, { label: 'River rise', value: 44 }, { label: 'Recent rainfall', value: 51 }, { label: 'Terrain exposure', value: 61 }],
    incidents: [{ id: '#4012', type: 'medical', priority: 'moderate', people: 1, risk: 58, ageLabel: '4 min', accuracyLabel: '±12m', status: 'submitted', latitude: 27.719, longitude: 85.326 }],
    safeZones: [{ id: 'sz-k1', name: 'Community Shelter Central', distanceLabel: '600 m', occupancy: 110, capacity: 400, status: 'recommended' }],
    responders: [{ id: 'rk1', name: 'Suman KC', status: 'available' }, { id: 'rk2', name: 'Asha Shahi', status: 'assigned', incidentId: '#4012' }],
  },
};

function ageLabel(createdAt: string) {
  const sec = Math.max(0, Math.round((Date.now() - Date.parse(createdAt)) / 1000));
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  return `${Math.floor(sec / 3600)} hr`;
}

function nearestDistrict(record: EmergencyRecord): DistrictId | null {
  const candidates = Object.values(HYBRID_DISTRICTS).map((d) => ({ id: d.id, delta: Math.hypot(record.latitude - d.center.lat, record.longitude - d.center.lng) }));
  candidates.sort((a, b) => a.delta - b.delta);
  return candidates[0] && candidates[0].delta < 1.25 ? candidates[0].id : null;
}

function emergencyToDistrictIncident(record: EmergencyRecord): DistrictIncident {
  const risk = Number(record.risk_score ?? 0);
  const priority: RiskBand = risk >= 80 ? 'critical' : risk >= 60 ? 'high' : risk >= 35 ? 'moderate' : 'low';
  return {
    id: record.id,
    type: record.emergency_type,
    priority,
    people: record.people_count,
    risk,
    ageLabel: ageLabel(record.created_at),
    accuracyLabel: record.accuracy_m != null ? `±${Math.round(record.accuracy_m)}m` : '—',
    status: record.status,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

async function getEmergencyRecordsSafe() {
  try { return await citizenSafetyApi.listEmergencies(); } catch { return [] as EmergencyRecord[]; }
}

export const adminDashboardApi = {
  async getOverview(): Promise<AdminDashboardOverview> {
    try {
      return await apiRequest<AdminDashboardOverview>('/admin/dashboard/overview', undefined, 2500);
    } catch {
      const records = await getEmergencyRecordsSafe();
      const active = records.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled');
      const realPeople = active.reduce((sum, r) => sum + Math.max(1, Number(r.people_count || 1)), 0);
      const assignedResponders = new Set(active.map((r) => r.responder_id).filter(Boolean)).size;
      const districts = Object.values(HYBRID_DISTRICTS).map((d) => ({ ...d }));
      return {
        source: 'hybrid', updatedAt: new Date().toISOString(),
        criticalDistricts: districts.filter((d) => d.riskBand === 'critical').length,
        activeIncidents: active.length || districts.reduce((s, d) => s + d.incidentCount, 0),
        peopleAtRisk: realPeople || districts.reduce((s, d) => s + d.peopleAtRisk, 0),
        activeResponders: assignedResponders || districts.reduce((s, d) => s + d.activeResponders, 0),
        districts,
        riskTrend: [{ label: '-4h', value: 42 }, { label: '-3h', value: 51 }, { label: '-2h', value: 63 }, { label: '-1h', value: 74 }, { label: 'now', value: 81 }],
        safeZoneCapacity: { total: 3400, assigned: realPeople || 1247, available: Math.max(0, 3400 - (realPeople || 1247)), loadPercent: Math.round(((realPeople || 1247) / 3400) * 100) },
      };
    }
  },

  async getDistrict(id: DistrictId): Promise<DistrictOperations> {
    try {
      return await apiRequest<DistrictOperations>(`/admin/dashboard/districts/${id}`, undefined, 2500);
    } catch {
      const base = structuredClone(HYBRID_DISTRICTS[id]);
      const records = await getEmergencyRecordsSafe();
      const districtRecords = records.filter((r) => r.status !== 'cancelled' && nearestDistrict(r) === id);
      if (districtRecords.length) {
        const active = districtRecords.filter((r) => r.status !== 'resolved');
        base.incidents = [...active.map(emergencyToDistrictIncident), ...base.incidents].slice(0, 8);
        base.incidentCount = active.length;
        base.peopleAtRisk = active.reduce((sum, r) => sum + Math.max(1, r.people_count), 0);
        base.activeResponders = new Set(active.map((r) => r.responder_id).filter(Boolean)).size || base.activeResponders;
      }
      return base;
    }
  },
};
