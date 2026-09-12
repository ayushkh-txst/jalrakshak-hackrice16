import { useEffect, useState } from 'react';
import { citizenSafetyApi, type EmergencyRecord, type EmergencyType, type SafetyContext } from '../api/citizen-safety.api';
import './CitizenEmergencyHelp.css';

type Props = {
  citizenId: string;
  citizenName: string;
  fallbackLatitude: number;
  fallbackLongitude: number;
  onBack: () => void;
};

type PositionState = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  label: string;
};

export default function CitizenEmergencyHelp({ citizenId, citizenName, fallbackLatitude, fallbackLongitude, onBack }: Props) {
  const [position, setPosition] = useState<PositionState>({
    latitude: fallbackLatitude,
    longitude: fallbackLongitude,
    accuracy: null,
    label: 'Demo location',
  });
  const [safety, setSafety] = useState<SafetyContext | null>(null);
  const [safetyError, setSafetyError] = useState('');
  const [type, setType] = useState<EmergencyType>('rescue');
  const [peopleCount, setPeopleCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<EmergencyRecord | null>(null);
  const [submitError, setSubmitError] = useState('');

  const refreshSafety = async (latitude: number, longitude: number) => {
    setSafetyError('');
    try {
      setSafety(await citizenSafetyApi.getContext(latitude, longitude));
    } catch (error) {
      setSafetyError(error instanceof Error ? error.message : 'Live environmental data unavailable');
    }
  };

  useEffect(() => {
    void refreshSafety(position.latitude, position.longitude);
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setPosition((current) => ({ ...current, label: 'Locating…' }));
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const next = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          label: 'Current GPS location',
        };
        setPosition(next);
        void refreshSafety(next.latitude, next.longitude);
      },
      () => setPosition((current) => ({ ...current, label: 'Location permission not granted' })),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submitEmergency = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await citizenSafetyApi.createEmergency({
        citizen_id: citizenId,
        citizen_name: citizenName,
        emergency_type: type,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy_m: position.accuracy,
        people_count: peopleCount,
        notes: notes.trim(),
        risk_score: safety?.prototype_risk_score ?? null,
        risk_level: safety?.prototype_risk_level ?? null,
        precipitation_next_6h_mm: safety?.precipitation_next_6h_mm ?? null,
        river_discharge_m3s: safety?.river_discharge_m3s ?? null,
      });
      setRecord(created);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to send emergency request');
    } finally {
      setSubmitting(false);
    }
  };

  if (record) {
    return (
      <section className="emergency-screen emergency-confirmed">
        <div className="emergency-confirm-icon">✓</div>
        <span className="safe-eyebrow">REQUEST SENT</span>
        <h1>Help request received</h1>
        <p>Your request is now in the responder queue. Keep your phone available and move only if it is safe to do so.</p>
        <div className="emergency-ticket">
          <div><span>REQUEST ID</span><strong>{record.id}</strong></div>
          <div><span>STATUS</span><strong>{record.status.toUpperCase()}</strong></div>
          <div><span>LOCATION</span><strong>{record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}</strong></div>
        </div>
        <button type="button" className="figma-secondary emergency-back" onClick={onBack}>Back to overview</button>
      </section>
    );
  }

  return (
    <section className="emergency-screen">
      <div className="emergency-heading">
        <div>
          <span className="safe-eyebrow">EMERGENCY HELP</span>
          <h1>Request immediate assistance</h1>
          <p>Your GPS location and the latest environmental snapshot will be attached to the request.</p>
        </div>
        <button type="button" className="location-button" onClick={useMyLocation}>⌖ Use my location</button>
      </div>

      <div className="emergency-grid">
        <div className="emergency-form-card">
          <span className="emergency-label">WHAT HELP DO YOU NEED?</span>
          <div className="emergency-type-grid">
            {(['rescue', 'medical', 'evacuation'] as EmergencyType[]).map((item) => (
              <button key={item} type="button" className={type === item ? 'active' : ''} onClick={() => setType(item)}>
                <strong>{item === 'rescue' ? 'Rescue' : item === 'medical' ? 'Medical' : 'Evacuation'}</strong>
                <span>{item === 'rescue' ? 'Trapped or unable to move' : item === 'medical' ? 'Urgent medical assistance' : 'Need transport to safety'}</span>
              </button>
            ))}
          </div>

          <label className="emergency-field">
            <span>NUMBER OF PEOPLE</span>
            <input type="number" min={1} max={50} value={peopleCount} onChange={(event) => setPeopleCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} />
          </label>

          <label className="emergency-field">
            <span>NOTES FOR RESPONDERS</span>
            <textarea value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Example: elderly person with us, water rising near the ground floor…" />
            <small>{notes.length}/500</small>
          </label>

          {submitError && <div className="emergency-error">{submitError}</div>}
          <button type="button" className="emergency-submit" onClick={submitEmergency} disabled={submitting}>
            {submitting ? 'SENDING REQUEST…' : 'SEND EMERGENCY REQUEST'}
          </button>
          <button type="button" className="figma-secondary emergency-back" onClick={onBack}>Cancel</button>
        </div>

        <aside className="emergency-context-card">
          <span className="emergency-label">ATTACHED LIVE CONTEXT</span>
          <div className="emergency-location-box">
            <strong>{position.label}</strong>
            <span>{position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</span>
            {position.accuracy !== null && <small>GPS accuracy ±{Math.round(position.accuracy)} m</small>}
          </div>

          {safety ? (
            <>
              <div className={`emergency-risk-level ${safety.prototype_risk_level}`}>
                <span>PROTOTYPE FLOOD RISK</span>
                <strong>{safety.prototype_risk_score}/100 · {safety.prototype_risk_level.toUpperCase()}</strong>
              </div>
              <div className="emergency-live-stats">
                <div><span>Rain next 6h</span><strong>{safety.precipitation_next_6h_mm.toFixed(1)} mm</strong></div>
                <div><span>Rain probability</span><strong>{safety.precipitation_probability_max_6h ?? '—'}%</strong></div>
                <div><span>River discharge</span><strong>{safety.river_discharge_m3s !== null ? `${safety.river_discharge_m3s.toFixed(1)} m³/s` : '—'}</strong></div>
                <div><span>River trend</span><strong>{safety.river_trend_percent !== null ? `${safety.river_trend_percent > 0 ? '+' : ''}${safety.river_trend_percent}%` : '—'}</strong></div>
              </div>
              <p className="emergency-source">Live source: {safety.source}. The displayed risk score is our hackathon prototype heuristic, not an official warning.</p>
            </>
          ) : (
            <div className="emergency-live-loading">{safetyError || 'Loading live rainfall and river data…'}</div>
          )}
        </aside>
      </div>
    </section>
  );
}
