import { apiRequest } from '../../../lib/api-client';

export type SafetyContext = {
  latitude: number;
  longitude: number;
  observed_at: string;
  source: string;
  temperature_c: number | null;
  precipitation_next_6h_mm: number;
  precipitation_probability_max_6h: number | null;
  river_discharge_m3s: number | null;
  river_discharge_tomorrow_m3s: number | null;
  river_trend_percent: number | null;
  prototype_risk_score: number;
  prototype_risk_level: 'low' | 'moderate' | 'high' | 'critical';
};

export type EmergencyType = 'rescue' | 'medical' | 'evacuation';
export type EmergencyStatus = 'submitted' | 'assigned' | 'en_route' | 'resolved' | 'cancelled';

export type EmergencyCreate = {
  citizen_id: string;
  citizen_name: string;
  emergency_type: EmergencyType;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  people_count: number;
  notes: string;
  risk_score?: number | null;
  risk_level?: string | null;
  precipitation_next_6h_mm?: number | null;
  river_discharge_m3s?: number | null;
};

export type EmergencyRecord = EmergencyCreate & {
  id: string;
  status: EmergencyStatus;
  created_at: string;
  updated_at?: string | null;
  responder_id?: string | null;
  responder_name?: string | null;
  is_demo?: boolean;
};

export type EmergencyLocationUpdate = {
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
};

export type EvacuationRouteStep = {
  instruction: string;
  distance_m: number;
  duration_s: number;
};

export type EvacuationRoute = {
  destination_name: string;
  destination_type: string;
  destination_latitude: number;
  destination_longitude: number;
  distance_m: number;
  duration_s: number;
  geometry: number[][];
  steps: EvacuationRouteStep[];
  alternatives_considered: number;
  prototype_safety_score: number;
  reasons: string[];
  source: string;
  warning: string;
};

export const citizenSafetyApi = {
  getContext(latitude: number, longitude: number): Promise<SafetyContext> {
    const params = new URLSearchParams({ latitude: latitude.toString(), longitude: longitude.toString() });
    return apiRequest<SafetyContext>(`/safety/context?${params.toString()}`);
  },
  getEvacuationRoute(latitude: number, longitude: number): Promise<EvacuationRoute> {
    const params = new URLSearchParams({ latitude: latitude.toString(), longitude: longitude.toString() });
    return apiRequest<EvacuationRoute>(`/routing/evacuation?${params.toString()}`, undefined, 5_500);
  },
  createEmergency(payload: EmergencyCreate): Promise<EmergencyRecord> {
    return apiRequest<EmergencyRecord>('/emergencies', { method: 'POST', body: JSON.stringify(payload) });
  },
  getEmergency(id: string): Promise<EmergencyRecord> {
    return apiRequest<EmergencyRecord>(`/emergencies/${id}`);
  },
  listEmergencies(): Promise<EmergencyRecord[]> {
    return apiRequest<EmergencyRecord[]>('/emergencies');
  },
  updateEmergency(id: string, payload: { status: EmergencyStatus; responder_id?: string; responder_name?: string }): Promise<EmergencyRecord> {
    return apiRequest<EmergencyRecord>(`/emergencies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  updateEmergencyLocation(id: string, payload: EmergencyLocationUpdate): Promise<EmergencyRecord> {
    return apiRequest<EmergencyRecord>(`/emergencies/${id}/location`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  cancelEmergency(id: string): Promise<EmergencyRecord> {
    return apiRequest<EmergencyRecord>(`/emergencies/${id}/cancel`, { method: 'POST' });
  },
};
