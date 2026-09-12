import { useEffect, useMemo, useState } from 'react';
import { authSession } from '../../auth/auth-session';
import { citizenSafetyApi, type EmergencyRecord, type EmergencyStatus } from '../api/citizen-safety.api';
import './WorkerDashboard.css';

export default function WorkerDashboard() {
  const session = authSession.get();
  const [records, setRecords] = useState<EmergencyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const workerName = session?.user.name ?? 'Demo E-Worker';
  const workerId = session?.user.id ?? 'worker-demo';

  const loadQueue = async () => {
    try {
      const data = await citizenSafetyApi.listEmergencies();
      setRecords(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load emergency queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
    const timer = window.setInterval(() => void loadQueue(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = useMemo(() => records.find((item) => item.id === selectedId) ?? records[0] ?? null, [records, selectedId]);
  const counts = useMemo(() => ({
    open: records.filter((r) => r.status !== 'resolved').length,
    submitted: records.filter((r) => r.status === 'submitted').length,
    active: records.filter((r) => r.status === 'assigned' || r.status === 'en_route').length,
    resolved: records.filter((r) => r.status === 'resolved').length,
  }), [records]);

  const updateStatus = async (status: EmergencyStatus) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const updated = await citizenSafetyApi.updateEmergency(selected.id, {
        status,
        responder_id: workerId,
        responder_name: workerName,
      });
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update incident');
    } finally {
      setUpdating(false);
    }
  };

  const timeAgo = (iso: string) => {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  };

  const mapUrl = selected ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - 0.01}%2C${selected.latitude - 0.007}%2C${selected.longitude + 0.01}%2C${selected.latitude + 0.007}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}` : '';

  return (
    <main className="worker-app">
      <header className="worker-topbar">
        <div className="worker-brand"><span>JALRAKSHAK · RESPONDER OPERATIONS</span><h1>Emergency Rescue Queue</h1></div>
        <div className="worker-live"><i /> LIVE · AUTO-REFRESH 5s</div>
      </header>

      <section className="worker-summary">
        <article><span>Open incidents</span><strong>{counts.open}</strong></article>
        <article><span>Unassigned</span><strong>{counts.submitted}</strong></article>
        <article><span>Active response</span><strong>{counts.active}</strong></article>
        <article><span>Resolved</span><strong>{counts.resolved}</strong></article>
      </section>

      {error && <div className="worker-error">{error}</div>}

      <section className="worker-grid">
        <div className="worker-panel">
          <div className="worker-panel-title"><h2>Incoming SOS</h2><button type="button" onClick={() => void loadQueue()}>Refresh</button></div>
          <div className="incident-list">
            {loading ? <div className="incident-empty">Loading responder queue…</div> : records.length === 0 ? <div className="incident-empty">No SOS requests yet. Submit one from the Citizen dashboard and it will appear here.</div> : records.map((record) => (
              <button key={record.id} type="button" className={`incident-card ${selected?.id === record.id ? 'active' : ''} ${record.risk_level === 'critical' ? 'critical' : record.risk_level === 'high' ? 'high' : ''}`} onClick={() => setSelectedId(record.id)}>
                <div className="incident-card-top"><span className="incident-id">{record.id}</span><span className="incident-priority">{record.status === 'submitted' ? 'NEW' : record.status.replace('_', ' ').toUpperCase()}</span></div>
                <h3>{record.emergency_type.toUpperCase()} · {record.citizen_name}</h3>
                <div className="incident-meta"><span>{record.people_count} {record.people_count === 1 ? 'person' : 'people'}</span><span>{record.risk_level ? `${record.risk_level.toUpperCase()} RISK` : 'Risk pending'}</span><span>{timeAgo(record.created_at)}</span></div>
              </button>
            ))}
          </div>
        </div>

        <div className="worker-panel">
          {!selected ? <div className="incident-empty">Select an emergency request to view details.</div> : (
            <div className="incident-detail">
              <div className="incident-hero">
                <div><span className="emergency-label">ACTIVE INCIDENT</span><h2>{selected.emergency_type.toUpperCase()} · {selected.citizen_name}</h2><div className="incident-meta"><span>{selected.id}</span><span>Created {timeAgo(selected.created_at)}</span></div></div>
                <span className={`status-pill ${selected.status}`}>{selected.status.replace('_', ' ').toUpperCase()}</span>
              </div>

              <div className="detail-grid">
                <div><span>People</span><strong>{selected.people_count}</strong></div>
                <div><span>Risk score</span><strong>{selected.risk_score ?? '—'}{selected.risk_score !== null && selected.risk_score !== undefined ? '/100' : ''}</strong></div>
                <div><span>GPS accuracy</span><strong>{selected.accuracy_m ? `±${Math.round(selected.accuracy_m)} m` : 'Demo location'}</strong></div>
              </div>

              <div className="worker-map"><iframe title="Citizen emergency location" src={mapUrl} loading="lazy" /></div>

              <div className="notes-box"><span>RESPONDER NOTES</span><p>{selected.notes || 'No additional notes provided.'}</p></div>

              <div className="environment-grid">
                <div><span>Rain next 6h</span><strong>{selected.precipitation_next_6h_mm !== null && selected.precipitation_next_6h_mm !== undefined ? `${selected.precipitation_next_6h_mm.toFixed(1)} mm` : '—'}</strong></div>
                <div><span>River discharge</span><strong>{selected.river_discharge_m3s !== null && selected.river_discharge_m3s !== undefined ? `${selected.river_discharge_m3s.toFixed(1)} m³/s` : '—'}</strong></div>
                <div><span>Latitude</span><strong>{selected.latitude.toFixed(5)}</strong></div>
                <div><span>Longitude</span><strong>{selected.longitude.toFixed(5)}</strong></div>
              </div>

              <div className="worker-actions">
                <button type="button" className="assign" disabled={updating || selected.status !== 'submitted'} onClick={() => void updateStatus('assigned')}>ASSIGN TO ME</button>
                <button type="button" className="enroute" disabled={updating || selected.status !== 'assigned'} onClick={() => void updateStatus('en_route')}>MARK EN ROUTE</button>
                <button type="button" className="resolve" disabled={updating || selected.status === 'resolved'} onClick={() => void updateStatus('resolved')}>RESOLVE INCIDENT</button>
              </div>
              {selected.responder_name && <div className="worker-footer-note">Assigned responder: {selected.responder_name}</div>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
