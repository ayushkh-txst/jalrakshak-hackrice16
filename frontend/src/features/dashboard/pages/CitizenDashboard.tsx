import { useEffect, useMemo, useRef, useState } from 'react';
import { authSession } from '../../auth/auth-session';
import { citizenSafetyApi, type EvacuationRoute } from '../api/citizen-safety.api';
import CitizenEmergencyHelp from './CitizenEmergencyHelp';
import './CitizenDashboard.css';
import './CitizenLiveMap.css';

type NavItem = 'Overview' | 'Live Map' | 'Alerts' | 'AI Assistant' | 'Emergency Help' | 'Recovery';
type BrowserLocation = { latitude: number; longitude: number } | null;
type MapCenter = { latitude: number; longitude: number };
type GuidanceStep = { title: string; detail: string; distance: string; eta: string };

const navItems: Array<{ label: NavItem; icon: string; badge?: number; muted?: boolean }> = [
  { label: 'Overview', icon: '▦' },
  { label: 'Live Map', icon: '◫' },
  { label: 'Alerts', icon: '♢', badge: 2 },
  { label: 'AI Assistant', icon: '▤' },
  { label: 'Emergency Help', icon: '⊙' },
  { label: 'Recovery', icon: '◷', muted: true },
];

const DEMO_CENTER = { latitude: 27.9516, longitude: 85.6846 };
const FALLBACK_SAFE_ZONE = { latitude: 27.9635, longitude: 85.7085 };
const fallbackGuidanceSteps: GuidanceStep[] = [
  { title: 'Head southeast to the upper road', detail: 'Stay away from the riverside lane.', distance: '920 m', eta: '13 min' },
  { title: 'Continue past the market junction', detail: 'The recommended path bypasses both closures.', distance: '610 m', eta: '9 min' },
  { title: 'Turn left toward the school road', detail: 'Remain on the marked higher-ground route.', distance: '280 m', eta: '4 min' },
  { title: 'Arrive at Shree Secondary School', detail: 'Enter through the east safe-zone entrance.', distance: '0 m', eta: 'Arrived' },
];

const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(1, Math.round(meters))} m`;
const formatDuration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;

const loadLeaflet = () => new Promise<any>((resolve, reject) => {
  const existing = (window as Window & { L?: any }).L;
  if (existing) return resolve(existing);
  if (!document.querySelector('link[data-jalrakshak-leaflet]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.dataset.jalrakshakLeaflet = 'true';
    document.head.appendChild(link);
  }
  const previousScript = document.querySelector<HTMLScriptElement>('script[data-jalrakshak-leaflet]');
  if (previousScript) {
    previousScript.addEventListener('load', () => resolve((window as Window & { L?: any }).L), { once: true });
    previousScript.addEventListener('error', reject, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.async = true;
  script.dataset.jalrakshakLeaflet = 'true';
  script.onload = () => resolve((window as Window & { L?: any }).L);
  script.onerror = reject;
  document.body.appendChild(script);
});

function InteractiveSafetyMap({ center, guidanceActive, route }: { center: MapCenter; guidanceActive: boolean; route: EvacuationRoute | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showRiskAreas, setShowRiskAreas] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let map: any;
    let disposed = false;
    loadLeaflet().then((L) => {
      if (disposed || !containerRef.current || !L) return;
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true })
        .setView([center.latitude, center.longitude], route ? 14 : 13);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri and contributors',
      }).addTo(map);

      L.circleMarker([center.latitude, center.longitude], {
        radius: guidanceActive ? 10 : 9, color: '#ffffff', weight: 4, fillColor: '#3d7fe8', fillOpacity: 1,
      }).addTo(map).bindPopup('<strong>You are here</strong><br/>Current citizen GPS location');

      const nearNepalDemo = Math.abs(center.latitude - DEMO_CENTER.latitude) < 0.5 && Math.abs(center.longitude - DEMO_CENTER.longitude) < 0.5;
      if (showRiskAreas && nearNepalDemo) {
        L.polygon([[27.9462,85.6740],[27.9530,85.6748],[27.9552,85.6804],[27.9526,85.6840],[27.9474,85.6830],[27.9448,85.6780]], {
          color:'#9f2725', weight:3, dashArray:'8 6', fillColor:'#b8322f', fillOpacity:.3,
        }).addTo(map).bindPopup('<strong>CRITICAL FLOOD RISK</strong><br/>Prototype risk polygon.');
        L.polygon([[27.9550,85.6892],[27.9615,85.6900],[27.9630,85.6992],[27.9583,85.7020],[27.9535,85.6960]], {
          color:'#d67c36', weight:3, dashArray:'8 6', fillColor:'#eda667', fillOpacity:.22,
        }).addTo(map).bindPopup('<strong>HIGH FLOOD RISK</strong><br/>Prototype risk polygon.');
      }

      const safeLat = route?.destination_latitude ?? FALLBACK_SAFE_ZONE.latitude;
      const safeLon = route?.destination_longitude ?? FALLBACK_SAFE_ZONE.longitude;
      if (showSafeZones) {
        const safeIcon = L.divIcon({ className:'jalrakshak-safe-marker', html:'<span>✓</span>', iconSize:[34,34], iconAnchor:[17,17] });
        L.marker([safeLat, safeLon], { icon:safeIcon }).addTo(map)
          .bindPopup(`<strong>${route?.destination_name ?? 'Shree Secondary School'}</strong><br/>Recommended evacuation destination`);
      }

      if (showRoute) {
        const points = route?.geometry?.length ? route.geometry : [[center.latitude, center.longitude],[safeLat,safeLon]];
        const polyline = L.polyline(points, {
          color: guidanceActive ? '#4f6f3d' : '#76623a', weight: guidanceActive ? 8 : 6, opacity:.95, lineJoin:'round',
        }).addTo(map);
        polyline.bindPopup(route ? '<strong>Recommended evacuation route</strong><br/>Real road geometry from OSRM.' : '<strong>Fallback route</strong>');
        if (route || guidanceActive) map.fitBounds(polyline.getBounds(), { padding:[45,45] });
      }
      window.setTimeout(() => map?.invalidateSize(), 80);
    }).catch(() => setMapError(true));
    return () => { disposed = true; if (map) map.remove(); };
  }, [center.latitude, center.longitude, route, showRiskAreas, showSafeZones, showRoute, guidanceActive]);

  return <>
    <div ref={containerRef} className="interactive-safety-map" aria-label="Interactive JalRakshak safety map" />
    {mapError && <div className="map-load-error">The interactive map could not load. Check your internet connection and refresh.</div>}
    <div className="map-layer-controls" aria-label="Map layer controls">
      <button type="button" className={showRiskAreas ? 'active' : ''} onClick={() => setShowRiskAreas(v => !v)}>Risk areas</button>
      <button type="button" className={showSafeZones ? 'active' : ''} onClick={() => setShowSafeZones(v => !v)}>Safe zones</button>
      <button type="button" className={showRoute ? 'active' : ''} onClick={() => setShowRoute(v => !v)}>Route</button>
    </div>
  </>;
}

export default function CitizenDashboard() {
  const session = authSession.get();
  const [activeNav, setActiveNav] = useState<NavItem>('Overview');
  const [showCriticalAlert, setShowCriticalAlert] = useState(true);
  const [browserLocation, setBrowserLocation] = useState<BrowserLocation>(null);
  const [locationStatus, setLocationStatus] = useState('Demo location');
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [guidanceStep, setGuidanceStep] = useState(0);
  const [routeData, setRouteData] = useState<EvacuationRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [showRouteReasons, setShowRouteReasons] = useState(false);

  const displayName = useMemo(() => {
    const name = session?.user.name?.trim();
    return name && name !== 'Demo Citizen' ? name : 'Ramesh K.';
  }, [session?.user.name]);
  const initials = displayName.split(' ').map(part => part[0]).join('').slice(0,1).toUpperCase();
  const mapCenter = browserLocation ?? DEMO_CENTER;

  const dynamicSteps: GuidanceStep[] = routeData?.steps?.length
    ? routeData.steps.map((step, index) => ({
        title: step.instruction,
        detail: index === routeData.steps.length - 1 ? `Continue toward ${routeData.destination_name}.` : 'Follow the highlighted road route.',
        distance: formatDistance(step.distance_m),
        eta: formatDuration(step.duration_s),
      }))
    : fallbackGuidanceSteps;
  const currentGuidance = dynamicSteps[Math.min(guidanceStep, dynamicSteps.length - 1)];
  const guidanceComplete = guidanceActive && guidanceStep === dynamicSteps.length - 1;
  const guidanceProgress = guidanceActive ? ((guidanceStep + 1) / dynamicSteps.length) * 100 : 0;

  const loadRoute = async (latitude: number, longitude: number) => {
    setRouteLoading(true); setRouteError('');
    try { setRouteData(await citizenSafetyApi.getEvacuationRoute(latitude, longitude)); }
    catch (error) { setRouteData(null); setRouteError(error instanceof Error ? error.message : 'Unable to calculate evacuation route'); }
    finally { setRouteLoading(false); }
  };

  useEffect(() => {
    if (activeNav === 'Live Map' && browserLocation) void loadRoute(browserLocation.latitude, browserLocation.longitude);
  }, [activeNav, browserLocation?.latitude, browserLocation?.longitude]);

  const signOut = () => { authSession.clear(); window.history.replaceState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); };
  const requestHelp = () => { setGuidanceActive(false); setShowCriticalAlert(false); setActiveNav('Emergency Help'); };
  const openGuide = () => { setShowCriticalAlert(false); setActiveNav('Live Map'); };
  const startGuidance = () => { setGuidanceStep(0); setGuidanceActive(true); setShowCriticalAlert(false); };
  const stopGuidance = () => { setGuidanceActive(false); setGuidanceStep(0); };
  const advanceGuidance = () => setGuidanceStep(step => Math.min(step + 1, dynamicSteps.length - 1));

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('Location unavailable'); return; }
    setLocationStatus('Locating…');
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setBrowserLocation(next);
      setLocationStatus(`Current GPS · ±${Math.round(position.coords.accuracy)} m`);
      void loadRoute(next.latitude, next.longitude);
    }, () => setLocationStatus('Permission not granted'), { enableHighAccuracy:true, timeout:8000 });
  };

  const renderOverview = () => <>
    <div className="figma-confidence-strip"><span className="confidence-dot"/><strong>HIGH CONFIDENCE</strong><span>+9m</span><span>·</span><span>12 sec ago</span></div>
    <section className="figma-risk-card">
      <div className="figma-risk-header"><div><span className="risk-header-dot"/> CRITICAL · FLOOD RISK</div><span>Risk increasing rapidly</span></div>
      <div className="figma-risk-body"><div className="warning-window"><span>ESTIMATED WARNING WINDOW</span><strong>~58 min</strong><p>Act before this window closes</p></div><div className="risk-score-ring"><div><strong>87</strong><span>/ 100</span></div></div><div className="risk-score-label">FLOOD RISK</div></div>
      <div className="risk-divider"/><div className="factor-section"><span className="factor-title">CONTRIBUTING FACTORS</span><div className="factor-row"><span>🌧️</span><strong>Heavy forecast rainfall</strong><em>+48mm in 6 hrs</em></div><div className="factor-row"><span>🌊</span><strong>Rising river level</strong><em>Bagmati +1.2m since 06:00</em></div><div className="factor-row"><span>🚧</span><strong>Road access degrading</strong><em>2 routes blocked</em></div></div>
    </section>
    <section className="figma-safe-card"><div className="safe-card-top"><div><span className="safe-eyebrow">RECOMMENDED SAFE DESTINATION</span><h2>{routeData?.destination_name ?? 'Shree Secondary School'}</h2><p>{routeData ? `◷ ${formatDuration(routeData.duration_s)}   ${formatDistance(routeData.distance_m)}` : '◷ 13 min   920 m   Capacity 61%'}</p></div><span className="low-risk-pill">LOW RISK</span></div><div className="safe-capacity-track"><span/></div><div className="safe-actions"><button type="button" className="figma-primary" onClick={openGuide}>GUIDE ME</button><button type="button" className="figma-secondary" onClick={() => setShowRouteReasons(v => !v)}>WHY THIS?</button></div></section>
    <section className="figma-quick-card"><span className="quick-title">QUICK ACTIONS</span><div><button type="button" onClick={() => setActiveNav('Live Map')}>🗺️ <span>View Safety Map</span></button><button type="button">🏫 <span>All Destinations</span></button></div></section>
  </>;

  const renderLiveMap = () => <section className={`live-map-screen ${guidanceActive ? 'guidance-active' : ''}`}>
    <div className="map-page-heading"><div><span className="safe-eyebrow">LIVE SAFETY MAP</span><h1>{guidanceActive ? 'Evacuation guidance' : 'Safest route around you'}</h1><p>{browserLocation ? 'Using your current GPS position with nearby OpenStreetMap facilities and real road geometry from OSRM.' : 'Use your location to calculate a nearby real-road evacuation route.'}</p></div><button type="button" className="location-button" onClick={useMyLocation}>⌖ Use my location</button></div>

    {guidanceActive && currentGuidance && <section className={`guidance-banner ${guidanceComplete ? 'complete' : ''}`}><div className="guidance-banner-icon">{guidanceComplete ? '✓' : '➜'}</div><div className="guidance-banner-copy"><span>{guidanceComplete ? 'DESTINATION REACHED' : `STEP ${guidanceStep + 1} OF ${dynamicSteps.length}`}</span><strong>{currentGuidance.title}</strong><p>{currentGuidance.detail}</p></div><div className="guidance-banner-metrics"><strong>{currentGuidance.distance}</strong><span>{currentGuidance.eta}</span></div><div className="guidance-progress"><span style={{width:`${guidanceProgress}%`}}/></div></section>}

    <div className="map-status-row"><span><i className="status-dot green"/> {locationStatus}</span><span><i className="status-dot gold"/> {routeLoading ? 'Calculating real road route…' : routeData ? `${routeData.alternatives_considered} route options considered` : 'Route not calculated'}</span>{guidanceActive && <span className="navigation-live"><i className="status-dot blue"/> Navigation active</span>}</div>
    {routeError && <div className="map-load-error">{routeError}</div>}

    <div className="map-layout">
      <div className="map-panel"><InteractiveSafetyMap center={mapCenter} guidanceActive={guidanceActive} route={routeData}/><div className="map-overlay-card map-you"><strong>YOU</strong><span>{mapCenter.latitude.toFixed(4)}, {mapCenter.longitude.toFixed(4)}</span></div><div className="map-overlay-card map-risk-legend"><span><i className="legend-swatch route"/> Recommended route</span><span><i className="legend-swatch safe"/> Safe destination</span></div></div>
      <aside className="route-panel">
        <span className="safe-eyebrow">{guidanceActive ? 'ACTIVE GUIDANCE' : 'RECOMMENDED EVACUATION'}</span>
        <h2>{routeLoading ? 'Calculating…' : routeData?.destination_name ?? 'Use your location first'}</h2>
        <div className="route-metrics"><div><strong>{routeData ? formatDuration(routeData.duration_s) : '—'}</strong><span>ETA</span></div><div><strong>{routeData ? formatDistance(routeData.distance_m) : '—'}</strong><span>Distance</span></div><div><strong>{routeData ? `${routeData.prototype_safety_score}/100` : '—'}</strong><span>Prototype safety</span></div></div>
        <div className="route-safety-note"><strong>{routeData ? '✓ Real road route calculated' : 'Waiting for current GPS'}</strong><p>{routeData ? `Compared ${routeData.alternatives_considered} road/destination options. Safety score is a prototype heuristic, not an official flood-clearance rating.` : 'Tap Use my location to find nearby facilities and calculate road routes.'}</p></div>
        {routeData && <button type="button" className="figma-secondary" style={{width:'100%',marginBottom:10}} onClick={() => setShowRouteReasons(v => !v)}>WHY THIS ROUTE?</button>}
        {showRouteReasons && routeData && <div className="route-safety-note"><strong>Why JalRakshak chose this</strong>{routeData.reasons.map(reason => <p key={reason}>• {reason}</p>)}<p><b>Source:</b> {routeData.source}</p><p>{routeData.warning}</p></div>}
        <div className="route-steps">{dynamicSteps.slice(0,6).map((step,index)=><div key={`${step.title}-${index}`} className={`${guidanceActive && index===guidanceStep?'current-step':''} ${guidanceActive && index<guidanceStep?'completed-step':''}`}><b>{guidanceActive&&index<guidanceStep?'✓':index+1}</b><span><strong>{step.title}</strong><small>{step.detail}</small></span></div>)}</div>
        {!guidanceActive ? <button type="button" className="figma-primary route-start" onClick={startGuidance} disabled={!routeData}>START GUIDANCE</button> : guidanceComplete ? <button type="button" className="figma-primary route-start guidance-finish" onClick={stopGuidance}>FINISH GUIDANCE</button> : <div className="guidance-actions"><button type="button" className="figma-primary route-start" onClick={advanceGuidance}>NEXT STEP</button><button type="button" className="figma-secondary guidance-stop" onClick={stopGuidance}>END GUIDANCE</button></div>}
        <button type="button" className="figma-danger-button route-help" onClick={requestHelp}>I CAN'T EVACUATE — GET HELP</button>
      </aside>
    </div>
    <div className="map-bottom-cards"><article><span>🧭</span><div><strong>{routeData ? `${routeData.alternatives_considered} alternatives ranked` : 'Waiting for GPS'}</strong><small>Real road routes are compared before recommendation</small></div></article><article><span>🏫</span><div><strong>{routeData?.destination_name ?? 'Nearby facility lookup'}</strong><small>{routeData ? routeData.destination_type.replace('_',' ') : 'OpenStreetMap facilities'}</small></div></article><article><span>📡</span><div><strong>{guidanceActive?'Guidance mode active':'Routing services connected'}</strong><small>OpenStreetMap + OSRM</small></div></article></div>
  </section>;

  const renderSecondaryPanel = () => {
    if (activeNav === 'Emergency Help') return <CitizenEmergencyHelp citizenId={session?.user.id ?? 'citizen-demo'} citizenName={displayName} fallbackLatitude={mapCenter.latitude} fallbackLongitude={mapCenter.longitude} onBack={() => setActiveNav('Overview')}/>;
    return <section className="figma-placeholder-panel"><span className="safe-eyebrow">{activeNav.toUpperCase()}</span><h2>{activeNav}</h2><p>{`${activeNav} is the next Citizen module to connect. The application shell and navigation are now in place.`}</p><button type="button" className="figma-secondary back-overview" onClick={() => setActiveNav('Overview')}>Back to overview</button></section>;
  };
  const renderActiveScreen = () => activeNav === 'Overview' ? renderOverview() : activeNav === 'Live Map' ? renderLiveMap() : renderSecondaryPanel();

  return <main className="figma-citizen-app">
    <aside className="figma-sidebar"><div className="sidebar-brand-row"><div className="sidebar-logo">⌄</div><div><strong>JalRakshak</strong><span>Citizen Safety</span></div><button type="button" className="collapse-button" aria-label="Collapse navigation">‹</button></div><div className="citizen-badge">CITIZEN</div><nav className="figma-nav" aria-label="Citizen navigation">{navItems.map(item => <button key={item.label} type="button" className={`${activeNav===item.label?'active':''} ${item.label==='Emergency Help'?'emergency-nav':''} ${item.muted?'muted-nav':''}`} onClick={() => setActiveNav(item.label)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.badge?<b>{item.badge}</b>:null}</button>)}</nav><div className="sidebar-user"><div className="user-avatar">{initials}</div><div><strong>{displayName}</strong><span>Citizen User</span></div><button type="button" onClick={signOut} title="Sign out">↪</button></div></aside>
    <section className="figma-main-shell"><header className="figma-topbar"><div className="location-line">⌖ &nbsp; {browserLocation ? 'Current GPS location' : 'Bagmati Valley, Sindhupalchowk'} &nbsp;·&nbsp; LIVE</div><div className="topbar-controls"><span className="live-status"><i/><i/> LIVE</span><button type="button" className="topbar-icon" aria-label="Notifications">♢<b>1</b></button><button type="button" className="language-button">EN</button><span className="topbar-avatar">{initials}</span></div></header><div className="figma-page-content">{renderActiveScreen()}</div></section>
    {showCriticalAlert && activeNav==='Overview' && <div className="critical-modal-backdrop" role="presentation"><section className="critical-modal" role="dialog" aria-modal="true" aria-labelledby="critical-alert-title"><div className="critical-modal-accent"/><div className="critical-modal-title-row"><div className="critical-icon">△</div><div><span>CRITICAL FLOOD WARNING</span><h2 id="critical-alert-title">Your area has entered a critical flood-risk state</h2></div></div><div className="critical-score-box"><div><span>RISK SCORE</span><strong>87</strong></div><div><span>UPDATED</span><strong>just now</strong></div></div><p className="critical-copy"><strong>Recommended action:</strong> Begin evacuation toward your assigned safe destination immediately.</p><button type="button" className="critical-guide" onClick={openGuide}>GUIDE ME</button><div className="critical-actions"><button type="button" className="critical-help" onClick={requestHelp}>I NEED HELP</button><button type="button" className="critical-details" onClick={() => setShowCriticalAlert(false)}>View Details</button></div></section></div>}
  </main>;
}
