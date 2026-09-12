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
  status: 'submitted' | 'assigned' | 'en_route' | 'resolved';
  created_at: string;
};

export const citizenSafetyApi = {
  getContext(latitude: number, longitude: number): Promise<SafetyContext> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });
    return apiRequest<SafetyContext>(`/safety/context?${params.toString()}`);
  },

  createEmergency(payload: EmergencyCreate): Promise<EmergencyRecord> {
    return apiRequest<EmergencyRecord>('/emergencies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
