import { useEffect, useMemo, useState } from 'react';
import { authSession } from '../../auth/auth-session';
import { citizenSafetyApi, type EmergencyRecord, type EmergencyStatus } from '../api/citizen-safety.api';
import './WorkerDashboard.css';
import './WorkerMapEnhancements.css';

type IconName = 'dashboard' | 'map' | 'incident' | 'queue' | 'chat' | 'report' | 'settings';
type ViewName = 'queue' | 'map';

function Icon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (name === 'map') return <svg {...common}><path d="M3 6.5 8.5 4l7 3 5.5-2.5v13L15.5 20l-7-3L3 19.5z"/><path d="M8.5 4v13M15.5 7v13"/></svg>;
  if (name === 'incident') return <svg {...common}><path d="M12 3 3 20h18L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>;
  if (name === 'queue') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
  if (name === 'chat') return <svg {...common}><path d="M4 5h16v11H8l-4 3z"/><path d="M8 9h8M8 12h5"/></svg>;
  if (name === 'report') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16v-3M12 16V9M16 16v-6"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.8 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2.1V9.6h.1a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.26 3.4l.06.06A1.7 1.7 0 0 0 8.2 3.8a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2.1h4v.1a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.2c.13.37.34.7.6 1 .28.26.63.4 1 .4h.1v4H21c-.37 0-.72.14-1 .4-.26.3-.47.63-.6 1Z"/></svg>;
}

const statusOrder: EmergencyStatus[] = ['submitted', 'assigned', 'en_route', 'resolved'];

function statusLabel(status: EmergencyStatus) {
  if (status === 'submitted') return 'NEW';
  if (status === 'assigned') return 'ASSIGNED';
  if (status === 'en_route') return 'EN ROUTE';
  return 'RESOLVED';
}

export default function WorkerDashboard() {
  const session = authSession.get();
  const [records, setRecords] = useState<EmergencyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>('queue');
  const [showDemo, setShowDemo] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const workerName = session?.user.name ?? 'Demo E-Worker';
  const workerId = session?.user.id ?? 'worker-demo';

  const loadQueue = async () => {
    try {
      const data = (await citizenSafetyApi.listEmergencies()).filter((item) => item.status !== 'cancelled');
      setRecords(data);
      setSelectedId((current) => current && data.some((item) => item.id === current) ? current : data[0]?.id ?? null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load emergency queue');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void loadQueue();
    const timer = window.setInterval(() => void loadQueue(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = useMemo(() => records.find((item) => item.id === selectedId) ?? records[0] ?? null, [records, selectedId]);
  const pendingCount = records.filter((r) => r.status === 'submitted' && !r.is_demo).length;

  const visibleMapRecords = useMemo(() => records.filter((record) => {
    if (!showDemo && record.is_demo) return false;
    if (!showResolved && record.status === 'resolved') return false;
    return true;
  }), [records, showDemo, showResolved]);

  const mapBounds = useMemo(() => {
    const list = visibleMapRecords.length ? visibleMapRecords : records;
    if (!list.length) return { minLat: 27.68, maxLat: 27.76, minLng: 85.28, maxLng: 85.37 };
    let minLat = Math.min(...list.map((r) => r.latitude));
    let maxLat = Math.max(...list.map((r) => r.latitude));
    let minLng = Math.min(...list.map((r) => r.longitude));
    let maxLng = Math.max(...list.map((r) => r.longitude));
    const latPad = Math.max((maxLat - minLat) * .18, .018);
    const lngPad = Math.max((maxLng - minLng) * .18, .025);
    minLat -= latPad; maxLat += latPad; minLng -= lngPad; maxLng += lngPad;
    return { minLat, maxLat, minLng, maxLng };
  }, [visibleMapRecords, records]);

  const operationsMapUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/export?bbox=${mapBounds.minLng},${mapBounds.minLat},${mapBounds.maxLng},${mapBounds.maxLat}&bboxSR=4326&imageSR=4326&size=1400,900&format=png32&transparent=false&f=image`;

  const markerPosition = (record: EmergencyRecord) => ({
    left: `${Math.max(3, Math.min(97, ((record.longitude - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 100))}%`,
    top: `${Math.max(4, Math.min(96, (1 - (record.latitude - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat)) * 100))}%`,
  });

  const updateStatus = async (status: EmergencyStatus) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const updated = await citizenSafetyApi.updateEmergency(selected.id, { status, responder_id: workerId, responder_name: workerName });
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update incident'); }
    finally { setUpdating(false); }
  };

  const timeAgo = (iso: string) => {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  };

  const mapUrl = selected ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - 0.01}%2C${selected.latitude - 0.007}%2C${selected.longitude + 0.01}%2C${selected.latitude + 0.007}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}` : '';
  const currentStatusIndex = selected ? statusOrder.indexOf(selected.status) : -1;

  const openIncidentFromMap = (record: EmergencyRecord) => {
    setSelectedId(record.id);
    setShowMap(false);
    setActiveView('queue');
  };

  return (
    <main className={`ops-shell ${activeView === 'map' ? 'map-mode' : ''}`}>
      <aside className="ops-sidebar">
        <div className="ops-logo-row"><div className="ops-logo">◒</div><div><strong>JalRakshak</strong><span>Emergency Response</span></div></div>
        <div className="ops-role">Responder</div>
        <nav className="ops-nav">
          <button><Icon name="dashboard"/><span>Dashboard</span></button>
          <button className={activeView === 'map' ? 'active' : ''} onClick={() => setActiveView('map')}><Icon name="map"/><span>Live Map</span></button>
          <button><Icon name="incident"/><span>All Incidents</span></button>
          <button className={activeView === 'queue' ? 'active' : ''} onClick={() => setActiveView('queue')}><Icon name="queue"/><span>Emergency Queue</span>{pendingCount > 0 && <b>{pendingCount}</b>}</button>
          <button><Icon name="chat"/><span>AI Assistant</span></button>
          <button><Icon name="report"/><span>Reports</span></button>
          <button><Icon name="settings"/><span>Settings</span></button>
        </nav>
        <div className="ops-user"><span>{workerName.slice(0,1).toUpperCase()}</span><div><strong>{workerName}</strong><small>Responder</small></div><b>›</b></div>
      </aside>

      {activeView === 'queue' ? <>
        <section className="ops-queue-pane">
          <header><h2>Approve Requests</h2><strong>Awaiting Approval: {pendingCount}</strong><span>Live SOS queue · auto-refresh 5s</span></header>
          <div className="ops-queue-list">
            {loading ? <div className="ops-empty">Loading emergency queue…</div> : records.length === 0 ? <div className="ops-empty">No SOS requests yet. Submit one from the Citizen dashboard and it will appear here.</div> : records.map((record) => (
              <button key={record.id} className={selected?.id === record.id ? 'active' : ''} onClick={() => { setSelectedId(record.id); setShowMap(false); }}>
                <div className="queue-top"><span>{record.id}</span>{record.is_demo ? <em className="demo-badge">DEMO</em> : record.status === 'submitted' ? <em>LIVE · NEW</em> : <em className="live-badge">LIVE</em>}<small>{timeAgo(record.created_at)}</small></div>
                <h3>{record.citizen_name}</h3>
                <div className="queue-bottom"><span className={`type ${record.emergency_type}`}>{record.emergency_type === 'rescue' ? 'Trapped Response' : record.emergency_type === 'medical' ? 'Medical Response' : 'Evacuation Response'}</span><strong>{record.people_count} {record.people_count === 1 ? 'person' : 'people'}</strong></div>
              </button>
            ))}
          </div>
          <div className="ops-citizen-sos"><span>CITIZEN SOS</span><button type="button">I NEED HELP</button></div>
        </section>

        <section className="ops-detail-pane">
          {error && <div className="ops-error">{error}</div>}
          {!selected ? <div className="ops-detail-empty">Select an emergency request to view details.</div> : <>
            <header className="ops-detail-header">
              <div><div className="ops-id-row"><span>{selected.id}</span>{selected.is_demo && <b className="ops-demo-label">DEMO INCIDENT</b>}<em>{selected.emergency_type === 'rescue' ? 'Trapped Response' : selected.emergency_type === 'medical' ? 'Medical Response' : 'Evacuation Response'}</em></div><h1>{selected.citizen_name}</h1><p>{selected.is_demo ? 'Seeded demonstration incident' : 'Live citizen SOS'} · {selected.people_count} {selected.people_count === 1 ? 'person' : 'people'} · {timeAgo(selected.created_at)}</p></div>
              <div className="ops-header-actions">
                <button className="primary" disabled={updating || selected.status !== 'submitted'} onClick={() => void updateStatus('assigned')}>Assign Responder</button>
                <button onClick={() => setShowMap((value) => !value)}>View on Map</button>
              </div>
            </header>

            {showMap && <div className="ops-inline-map"><iframe title="Citizen emergency location" src={mapUrl} loading="lazy"/></div>}

            <div className="ops-main-grid">
              <article className="ops-card ops-timeline">
                <span className="ops-card-label">RESPONSE TIMELINE</span>
                {[
                  ['Received','Request entered queue'],['Acknowledged','Responder review'],['Assigned', selected.responder_name || 'Awaiting responder'],['En Route','Responder traveling'],['On Scene','Field response'],['Resolved','Incident closed'],
                ].map(([label, sub], index) => {
                  const stageMap = [0,0,1,2,3,3];
                  const done = currentStatusIndex >= stageMap[index];
                  const current = (selected.status === 'submitted' && index === 0) || (selected.status === 'assigned' && index === 2) || (selected.status === 'en_route' && index === 3) || (selected.status === 'resolved' && index === 5);
                  return <div className={`timeline-row ${done ? 'done' : ''} ${current ? 'current' : ''}`} key={label}><i>{done ? '✓' : ''}</i><div><strong>{label}{current && <em>CURRENT</em>}</strong><span>{sub}</span></div></div>;
                })}
                <div className="timeline-actions"><button disabled={updating || selected.status !== 'assigned'} onClick={() => void updateStatus('en_route')}>Mark En Route</button><button disabled={updating || selected.status === 'resolved'} onClick={() => void updateStatus('resolved')}>Resolve Incident</button></div>
              </article>

              <div className="ops-side-stack">
                <article className="ops-card responder-card"><span className="ops-card-label">ASSIGNED RESPONDER</span>{selected.responder_name ? <div className="responder-row"><span>{selected.responder_name.slice(0,2).toUpperCase()}</span><div><strong>{selected.responder_name}</strong><small>Responder unit · assigned</small></div><em>{selected.status === 'en_route' ? '● En Route' : selected.status === 'resolved' ? '✓ Resolved' : '● Assigned'}</em></div> : <div className="unassigned">No responder assigned yet.</div>}</article>
                <article className="ops-card ai-card"><span className="ops-card-label">▱ AI GUIDANCE</span><p>{selected.risk_score !== null && selected.risk_score !== undefined && selected.risk_score >= 70 ? 'High flood-risk context detected. Prioritize rapid assignment and verify road access before dispatch.' : 'Review live GPS, rainfall, and river context before assigning the closest available response unit.'}</p>{selected.notes && <p><strong>Citizen note:</strong> {selected.notes}</p>}</article>
                <article className="ops-card metric-card"><div><span>RAIN NEXT 6H</span><strong>{selected.precipitation_next_6h_mm != null ? `${selected.precipitation_next_6h_mm.toFixed(1)} mm` : '—'}</strong></div><div><span>RISK SCORE</span><strong>{selected.risk_score != null ? `${selected.risk_score} / 100` : '—'}</strong></div><div><span>GPS ACCURACY</span><strong>{selected.accuracy_m != null ? `±${Math.round(selected.accuracy_m)}m` : '—'}</strong></div><div><span>ELAPSED</span><strong>{timeAgo(selected.created_at).replace(' ago','')}</strong></div><div><span>RIVER DISCHARGE</span><strong>{selected.river_discharge_m3s != null ? `${selected.river_discharge_m3s.toFixed(1)} m³/s` : '—'}</strong></div><div><span>LOCATION</span><strong>{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</strong></div></article>
              </div>
            </div>
          </>}
        </section>
      </> : <section className="ops-map-page">
        <header className="ops-map-header">
          <div><span className="ops-card-label">LIVE OPERATIONS MAP</span><h1>Active emergency response</h1><p>English-first street map with live SOS positions from the emergency database. Risk areas and safe zones are prototype operational overlays.</p></div>
          <div className="ops-map-live">● LIVE · AUTO-REFRESH 5s</div>
        </header>

        <div className="ops-map-stats">
          <div><span>ACTIVE INCIDENTS</span><strong>{records.filter((r) => r.status !== 'resolved').length}</strong></div>
          <div><span>LIVE SOS</span><strong>{records.filter((r) => !r.is_demo && r.status !== 'resolved').length}</strong></div>
          <div><span>UNASSIGNED</span><strong>{records.filter((r) => r.status === 'submitted').length}</strong></div>
          <div><span>EN ROUTE</span><strong>{records.filter((r) => r.status === 'en_route').length}</strong></div>
        </div>

        <div className="ops-map-toolbar">
          <button className={showDemo ? 'active' : ''} onClick={() => setShowDemo((v) => !v)}>DEMO incidents</button>
          <button className={showResolved ? 'active' : ''} onClick={() => setShowResolved((v) => !v)}>Resolved</button>
          <span><i className="legend-dot live"/> Live SOS</span><span><i className="legend-dot demo"/> Demo</span><span><i className="legend-dot assigned"/> Assigned</span><span><i className="legend-dot route"/> En route</span>
        </div>

        <div className="ops-map-layout">
          <div className="ops-operations-map">
            <img className="ops-map-basemap" src={operationsMapUrl} alt="English street map for responder operations"/>
            <div className="ops-risk-wash risk-one"><span>CRITICAL RISK</span></div>
            <div className="ops-risk-wash risk-two"><span>HIGH RISK</span></div>
            {visibleMapRecords.map((record) => (
              <button key={record.id} className={`ops-map-marker ${record.is_demo ? 'demo' : 'live'} ${record.status}`} style={markerPosition(record)} onClick={() => setSelectedId(record.id)} title={`${record.citizen_name} · ${statusLabel(record.status)}`}>
                <span>{record.emergency_type === 'medical' ? '+' : record.emergency_type === 'evacuation' ? '↗' : '!'}</span>
                {!record.is_demo && record.status !== 'resolved' && <i/>}
              </button>
            ))}
            <div className="ops-safe-zone zone-a"><b>✓</b><span>SAFE ZONE</span></div>
            <div className="ops-safe-zone zone-b"><b>✓</b><span>SHELTER</span></div>
            <div className="ops-map-key"><div><i className="key-critical"/> Critical / high-risk area</div><div><i className="key-safe"/> Safe zone</div><div><i className="key-live"/> Live SOS</div></div>
          </div>

          <aside className="ops-map-side">
            {selected ? <>
              <div className="ops-map-selected-head"><div><span>{selected.id}</span>{selected.is_demo ? <em>DEMO</em> : <em className="live">LIVE</em>}</div><h2>{selected.citizen_name}</h2><p>{selected.emergency_type.toUpperCase()} · {selected.people_count} {selected.people_count === 1 ? 'person' : 'people'}</p></div>
              <div className={`ops-map-status ${selected.status}`}>{statusLabel(selected.status)}</div>
              <div className="ops-map-detail-grid"><div><span>RISK</span><strong>{selected.risk_score ?? '—'}/100</strong></div><div><span>RAIN 6H</span><strong>{selected.precipitation_next_6h_mm != null ? `${selected.precipitation_next_6h_mm.toFixed(1)} mm` : '—'}</strong></div><div><span>GPS</span><strong>{selected.accuracy_m != null ? `±${Math.round(selected.accuracy_m)}m` : '—'}</strong></div><div><span>AGE</span><strong>{timeAgo(selected.created_at)}</strong></div></div>
              {selected.responder_name ? <div className="ops-map-responder"><span>{selected.responder_name.slice(0,2).toUpperCase()}</span><div><small>ASSIGNED RESPONDER</small><strong>{selected.responder_name}</strong></div></div> : <div className="ops-map-unassigned">No responder assigned.</div>}
              {selected.notes && <div className="ops-map-note"><span>CITIZEN NOTE</span><p>{selected.notes}</p></div>}
              <div className="ops-map-actions"><button className="primary" onClick={() => openIncidentFromMap(selected)}>Open Incident</button>{selected.status === 'submitted' && <button disabled={updating} onClick={() => void updateStatus('assigned')}>Assign to me</button>}</div>
            </> : <div className="ops-map-empty">Select an SOS marker to inspect the incident.</div>}
          </aside>
        </div>
      </section>}
    </main>
  );
}