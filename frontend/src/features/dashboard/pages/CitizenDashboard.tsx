import { useEffect, useMemo, useRef, useState } from 'react';
import { authSession } from '../../auth/auth-session';
import './CitizenDashboard.css';
import './CitizenLiveMap.css';

type NavItem = 'Overview' | 'Live Map' | 'Alerts' | 'AI Assistant' | 'Emergency Help' | 'Recovery';

type BrowserLocation = {
  latitude: number;
  longitude: number;
} | null;

type MapCenter = {
  latitude: number;
  longitude: number;
};

type GuidanceStep = {
  title: string;
  detail: string;
  distance: string;
  eta: string;
};

const navItems: Array<{ label: NavItem; icon: string; badge?: number; muted?: boolean }> = [
  { label: 'Overview', icon: '▦' },
  { label: 'Live Map', icon: '◫' },
  { label: 'Alerts', icon: '♢', badge: 2 },
  { label: 'AI Assistant', icon: '▤' },
  { label: 'Emergency Help', icon: '⊙' },
  { label: 'Recovery', icon: '◷', muted: true },
];

const DEMO_CENTER = { latitude: 27.9516, longitude: 85.6846 };
const SAFE_ZONE = { latitude: 27.9635, longitude: 85.7085 };

const ROUTE_POINTS: Array<[number, number]> = [
  [27.9516, 85.6846],
  [27.9494, 85.6883],
  [27.9492, 85.6978],
  [27.9538, 85.7048],
  [27.9588, 85.7072],
  [SAFE_ZONE.latitude, SAFE_ZONE.longitude],
];

const guidanceSteps: GuidanceStep[] = [
  { title: 'Head southeast to the upper road', detail: 'Stay away from the riverside lane.', distance: '920 m', eta: '13 min' },
  { title: 'Continue past the market junction', detail: 'The recommended path bypasses both closures.', distance: '610 m', eta: '9 min' },
  { title: 'Turn left toward the school road', detail: 'Remain on the marked higher-ground route.', distance: '280 m', eta: '4 min' },
  { title: 'Arrive at Shree Secondary School', detail: 'Enter through the east safe-zone entrance.', distance: '0 m', eta: 'Arrived' },
];

const loadLeaflet = () =>
  new Promise<any>((resolve, reject) => {
    const existing = (window as Window & { L?: any }).L;
    if (existing) {
      resolve(existing);
      return;
    }

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

function InteractiveSafetyMap({
  center,
  guidanceActive,
}: {
  center: MapCenter;
  guidanceActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showRiskAreas, setShowRiskAreas] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let map: any;
    let disposed = false;

    loadLeaflet()
      .then((L) => {
        if (disposed || !containerRef.current || !L) return;

        map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
        }).setView([center.latitude, center.longitude], guidanceActive ? 14 : 13);

        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri and contributors',
          },
        ).addTo(map);

        const userMarker = L.circleMarker([center.latitude, center.longitude], {
          radius: guidanceActive ? 10 : 9,
          color: '#ffffff',
          weight: 4,
          fillColor: '#3d7fe8',
          fillOpacity: 1,
        }).addTo(map);
        userMarker.bindPopup('<strong>You are here</strong><br/>Current/demo citizen location');

        if (showRiskAreas) {
          const criticalArea = L.polygon(
            [
              [27.9462, 85.6740],
              [27.9530, 85.6748],
              [27.9552, 85.6804],
              [27.9526, 85.6840],
              [27.9474, 85.6830],
              [27.9448, 85.6780],
            ],
            {
              color: '#9f2725',
              weight: 3,
              dashArray: '8 6',
              fillColor: '#b8322f',
              fillOpacity: 0.3,
            },
          ).addTo(map);
          criticalArea.bindPopup('<strong>CRITICAL FLOOD RISK</strong><br/>Avoid this zone. Rapid inundation is possible.');

          const highRiskArea = L.polygon(
            [
              [27.9550, 85.6892],
              [27.9615, 85.6900],
              [27.9630, 85.6992],
              [27.9583, 85.7020],
              [27.9535, 85.6960],
            ],
            {
              color: '#d67c36',
              weight: 3,
              dashArray: '8 6',
              fillColor: '#eda667',
              fillOpacity: 0.22,
            },
          ).addTo(map);
          highRiskArea.bindPopup('<strong>HIGH FLOOD RISK</strong><br/>Conditions may worsen. Prepare to move to higher ground.');
        }

        if (showRoute) {
          const routePoints = ROUTE_POINTS.map(([latitude, longitude], index) =>
            index === 0 ? [center.latitude, center.longitude] : [latitude, longitude],
          );
          const route = L.polyline(routePoints, {
            color: guidanceActive ? '#5d4a27' : '#76623a',
            weight: guidanceActive ? 8 : 6,
            opacity: 0.94,
            lineJoin: 'round',
          }).addTo(map);
          route.bindPopup('<strong>Recommended evacuation route</strong><br/>Demo route visibly avoids the marked flood zones and road closures.');

          if (guidanceActive) {
            map.fitBounds(route.getBounds(), { padding: [45, 45] });
          }
        }

        if (showSafeZones) {
          const safeIcon = L.divIcon({
            className: 'jalrakshak-safe-marker',
            html: '<span>✓</span>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
          const safeMarker = L.marker([SAFE_ZONE.latitude, SAFE_ZONE.longitude], { icon: safeIcon }).addTo(map);
          safeMarker.bindPopup('<strong>Shree Secondary School</strong><br/>Recommended safe destination · Outside current risk polygons · Demo capacity 61%');
        }

        const closureIcon = L.divIcon({
          className: 'jalrakshak-closure-marker',
          html: '<span>!</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([27.9518, 85.6810], { icon: closureIcon })
          .addTo(map)
          .bindPopup('<strong>Road closure</strong><br/>Riverside road temporarily blocked.');
        L.marker([27.9572, 85.6950], { icon: closureIcon })
          .addTo(map)
          .bindPopup('<strong>Road closure</strong><br/>Low-lying crossing reported unsafe.');

        window.setTimeout(() => map?.invalidateSize(), 80);
      })
      .catch(() => setMapError(true));

    return () => {
      disposed = true;
      if (map) map.remove();
    };
  }, [center.latitude, center.longitude, showRiskAreas, showSafeZones, showRoute, guidanceActive]);

  return (
    <>
      <div ref={containerRef} className="interactive-safety-map" aria-label="Interactive JalRakshak safety map" />
      {mapError && (
        <div className="map-load-error">The interactive map could not load. Check your internet connection and refresh.</div>
      )}
      <div className="map-layer-controls" aria-label="Map layer controls">
        <button type="button" className={showRiskAreas ? 'active' : ''} onClick={() => setShowRiskAreas((value) => !value)}>Risk areas</button>
        <button type="button" className={showSafeZones ? 'active' : ''} onClick={() => setShowSafeZones((value) => !value)}>Safe zones</button>
        <button type="button" className={showRoute ? 'active' : ''} onClick={() => setShowRoute((value) => !value)}>Route</button>
      </div>
    </>
  );
}

export default function CitizenDashboard() {
  const session = authSession.get();
  const [activeNav, setActiveNav] = useState<NavItem>('Overview');
  const [showCriticalAlert, setShowCriticalAlert] = useState(true);
  const [helpRequested, setHelpRequested] = useState(false);
  const [browserLocation, setBrowserLocation] = useState<BrowserLocation>(null);
  const [locationStatus, setLocationStatus] = useState('Demo location');
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [guidanceStep, setGuidanceStep] = useState(0);

  const displayName = useMemo(() => {
    const name = session?.user.name?.trim();
    return name && name !== 'Demo Citizen' ? name : 'Ramesh K.';
  }, [session?.user.name]);

  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 1)
    .toUpperCase();

  const mapCenter = browserLocation ?? DEMO_CENTER;
  const currentGuidance = guidanceSteps[guidanceStep];
  const guidanceComplete = guidanceActive && guidanceStep === guidanceSteps.length - 1;
  const guidanceProgress = guidanceActive ? ((guidanceStep + 1) / guidanceSteps.length) * 100 : 0;

  const signOut = () => {
    authSession.clear();
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const requestHelp = () => {
    setHelpRequested(true);
    setGuidanceActive(false);
    setShowCriticalAlert(false);
    setActiveNav('Emergency Help');
  };

  const openGuide = () => {
    setShowCriticalAlert(false);
    setActiveNav('Live Map');
  };

  const startGuidance = () => {
    setGuidanceStep(0);
    setGuidanceActive(true);
    setShowCriticalAlert(false);
  };

  const stopGuidance = () => {
    setGuidanceActive(false);
    setGuidanceStep(0);
  };

  const advanceGuidance = () => {
    setGuidanceStep((step) => Math.min(step + 1, guidanceSteps.length - 1));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location unavailable');
      return;
    }

    setLocationStatus('Locating…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('Current location');
      },
      () => setLocationStatus('Permission not granted'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const renderOverview = () => (
    <>
      <div className="figma-confidence-strip">
        <span className="confidence-dot" />
        <strong>HIGH CONFIDENCE</strong>
        <span>+9m</span>
        <span>·</span>
        <span>12 sec ago</span>
      </div>

      <section className="figma-risk-card">
        <div className="figma-risk-header">
          <div><span className="risk-header-dot" /> CRITICAL · FLOOD RISK</div>
          <span>Risk increasing rapidly</span>
        </div>
        <div className="figma-risk-body">
          <div className="warning-window">
            <span>ESTIMATED WARNING WINDOW</span>
            <strong>~58 min</strong>
            <p>Act before this window closes</p>
          </div>
          <div className="risk-score-ring" aria-label="Flood risk score 87 out of 100">
            <div><strong>87</strong><span>/ 100</span></div>
          </div>
          <div className="risk-score-label">FLOOD RISK</div>
        </div>
        <div className="risk-divider" />
        <div className="factor-section">
          <span className="factor-title">CONTRIBUTING FACTORS</span>
          <div className="factor-row"><span>🌧️</span><strong>Heavy forecast rainfall</strong><em>+48mm in 6 hrs</em></div>
          <div className="factor-row"><span>🌊</span><strong>Rising river level</strong><em>Bagmati +1.2m since 06:00</em></div>
          <div className="factor-row"><span>🚧</span><strong>Road access degrading</strong><em>2 routes blocked</em></div>
        </div>
      </section>

      <section className="figma-safe-card">
        <div className="safe-card-top">
          <div>
            <span className="safe-eyebrow">RECOMMENDED SAFE DESTINATION</span>
            <h2>Shree Secondary School</h2>
            <p>◷ 13 min &nbsp;&nbsp; 920 m &nbsp;&nbsp; Capacity 61%</p>
          </div>
          <span className="low-risk-pill">LOW RISK</span>
        </div>
        <div className="safe-capacity-track"><span /></div>
        <div className="safe-actions">
          <button type="button" className="figma-primary" onClick={openGuide}>GUIDE ME</button>
          <button type="button" className="figma-secondary">WHY THIS?</button>
        </div>
      </section>

      <section className="figma-quick-card">
        <span className="quick-title">QUICK ACTIONS</span>
        <div>
          <button type="button" onClick={() => setActiveNav('Live Map')}>🗺️ <span>View Safety Map</span></button>
          <button type="button">🏫 <span>All Destinations</span></button>
        </div>
      </section>
    </>
  );

  const renderLiveMap = () => (
    <section className={`live-map-screen ${guidanceActive ? 'guidance-active' : ''}`}>
      <div className="map-page-heading">
        <div>
          <span className="safe-eyebrow">LIVE SAFETY MAP</span>
          <h1>{guidanceActive ? 'Evacuation guidance' : 'Safest route around you'}</h1>
          <p>English-friendly live map tiles are provided by Esri. Risk areas, closures, and the evacuation route are interactive demo overlays until the live flood feeds are connected.</p>
        </div>
        <button type="button" className="location-button" onClick={useMyLocation}>⌖ Use my location</button>
      </div>

      {guidanceActive && (
        <section className={`guidance-banner ${guidanceComplete ? 'complete' : ''}`}>
          <div className="guidance-banner-icon">{guidanceComplete ? '✓' : '➜'}</div>
          <div className="guidance-banner-copy">
            <span>{guidanceComplete ? 'SAFE DESTINATION REACHED' : `STEP ${guidanceStep + 1} OF ${guidanceSteps.length}`}</span>
            <strong>{currentGuidance.title}</strong>
            <p>{currentGuidance.detail}</p>
          </div>
          <div className="guidance-banner-metrics">
            <strong>{currentGuidance.distance}</strong>
            <span>{currentGuidance.eta}</span>
          </div>
          <div className="guidance-progress"><span style={{ width: `${guidanceProgress}%` }} /></div>
        </section>
      )}

      <div className="map-status-row">
        <span><i className="status-dot green" /> {locationStatus}</span>
        <span><i className="status-dot red" /> Critical flood zone nearby</span>
        <span><i className="status-dot gold" /> 2 road closures</span>
        {guidanceActive && <span className="navigation-live"><i className="status-dot blue" /> Navigation active</span>}
      </div>

      <div className="map-layout">
        <div className="map-panel">
          <InteractiveSafetyMap center={mapCenter} guidanceActive={guidanceActive} />
          <div className="map-overlay-card map-you">
            <strong>YOU</strong>
            <span>{mapCenter.latitude.toFixed(4)}, {mapCenter.longitude.toFixed(4)}</span>
          </div>
          <div className="map-overlay-card map-risk-legend">
            <span><i className="legend-swatch critical" /> Critical risk</span>
            <span><i className="legend-swatch high-risk" /> High risk</span>
            <span><i className="legend-swatch route" /> Recommended route</span>
            <span><i className="legend-swatch safe" /> Safe destination</span>
          </div>
        </div>

        <aside className="route-panel">
          <span className="safe-eyebrow">{guidanceActive ? 'ACTIVE GUIDANCE' : 'RECOMMENDED EVACUATION'}</span>
          <h2>Shree Secondary School</h2>
          <div className="route-metrics">
            <div><strong>{guidanceActive ? currentGuidance.eta : '13 min'}</strong><span>ETA</span></div>
            <div><strong>{guidanceActive ? currentGuidance.distance : '920 m'}</strong><span>Distance</span></div>
            <div><strong>61%</strong><span>Capacity</span></div>
          </div>
          <div className="route-safety-note">
            <strong>✓ Route currently passable</strong>
            <p>The safe destination is outside both demo flood polygons. The route stays on higher ground and bypasses two reported closures.</p>
          </div>
          <div className="route-steps">
            {guidanceSteps.map((step, index) => (
              <div key={step.title} className={`${guidanceActive && index === guidanceStep ? 'current-step' : ''} ${guidanceActive && index < guidanceStep ? 'completed-step' : ''}`}>
                <b>{guidanceActive && index < guidanceStep ? '✓' : index + 1}</b>
                <span><strong>{step.title}</strong><small>{step.detail}</small></span>
              </div>
            ))}
          </div>

          {!guidanceActive ? (
            <button type="button" className="figma-primary route-start" onClick={startGuidance}>START GUIDANCE</button>
          ) : guidanceComplete ? (
            <button type="button" className="figma-primary route-start guidance-finish" onClick={stopGuidance}>FINISH GUIDANCE</button>
          ) : (
            <div className="guidance-actions">
              <button type="button" className="figma-primary route-start" onClick={advanceGuidance}>NEXT DEMO STEP</button>
              <button type="button" className="figma-secondary guidance-stop" onClick={stopGuidance}>END GUIDANCE</button>
            </div>
          )}
          <button type="button" className="figma-danger-button route-help" onClick={requestHelp}>I CAN'T EVACUATE — GET HELP</button>
        </aside>
      </div>

      <div className="map-bottom-cards">
        <article><span>🚧</span><div><strong>2 closures avoided</strong><small>Both are excluded from the recommended route</small></div></article>
        <article><span>🏫</span><div><strong>Safe zone outside risk areas</strong><small>Demo capacity: 61%</small></div></article>
        <article><span>📡</span><div><strong>{guidanceActive ? 'Guidance mode active' : 'Live map connected'}</strong><small>Esri World Street Map base layer</small></div></article>
      </div>
    </section>
  );

  const renderSecondaryPanel = () => (
    <section className="figma-placeholder-panel">
      <span className="safe-eyebrow">{activeNav.toUpperCase()}</span>
      <h2>{activeNav}</h2>
      <p>
        {activeNav === 'Emergency Help'
          ? helpRequested
            ? 'Your demo help request has been recorded. A responder workflow will be connected next.'
            : 'Use this screen to request rescue, medical assistance, or evacuation support.'
          : `${activeNav} is the next Citizen module to connect. The application shell and navigation are now in place.`}
      </p>
      {activeNav === 'Emergency Help' && !helpRequested && (
        <button type="button" className="figma-danger-button" onClick={requestHelp}>REQUEST EMERGENCY HELP</button>
      )}
      <button type="button" className="figma-secondary back-overview" onClick={() => setActiveNav('Overview')}>Back to overview</button>
    </section>
  );

  const renderActiveScreen = () => {
    if (activeNav === 'Overview') return renderOverview();
    if (activeNav === 'Live Map') return renderLiveMap();
    return renderSecondaryPanel();
  };

  return (
    <main className="figma-citizen-app">
      <aside className="figma-sidebar">
        <div className="sidebar-brand-row">
          <div className="sidebar-logo">⌄</div>
          <div>
            <strong>JalRakshak</strong>
            <span>Citizen Safety</span>
          </div>
          <button type="button" className="collapse-button" aria-label="Collapse navigation">‹</button>
        </div>

        <div className="citizen-badge">CITIZEN</div>

        <nav className="figma-nav" aria-label="Citizen navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`${activeNav === item.label ? 'active' : ''} ${item.label === 'Emergency Help' ? 'emergency-nav' : ''} ${item.muted ? 'muted-nav' : ''}`}
              onClick={() => setActiveNav(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <b>{item.badge}</b> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div>
            <strong>{displayName}</strong>
            <span>Citizen User</span>
          </div>
          <button type="button" onClick={signOut} title="Sign out">↪</button>
        </div>
      </aside>

      <section className="figma-main-shell">
        <header className="figma-topbar">
          <div className="location-line">⌖ &nbsp; Bagmati Valley, Sindhupalchowk &nbsp;·&nbsp; 12 Sept 2026 &nbsp;·&nbsp; 03:17 NPT</div>
          <div className="topbar-controls">
            <span className="live-status"><i /><i /> LIVE</span>
            <button type="button" className="topbar-icon" aria-label="Notifications">♢<b>1</b></button>
            <button type="button" className="language-button">EN</button>
            <span className="topbar-avatar">{initials}</span>
          </div>
        </header>

        <div className="figma-page-content">
          {renderActiveScreen()}
        </div>
      </section>

      {showCriticalAlert && activeNav === 'Overview' && (
        <div className="critical-modal-backdrop" role="presentation">
          <section className="critical-modal" role="dialog" aria-modal="true" aria-labelledby="critical-alert-title">
            <div className="critical-modal-accent" />
            <div className="critical-modal-title-row">
              <div className="critical-icon">△</div>
              <div>
                <span>CRITICAL FLOOD WARNING</span>
                <h2 id="critical-alert-title">Your area has entered a critical flood-risk state</h2>
              </div>
            </div>
            <div className="critical-score-box">
              <div><span>RISK SCORE</span><strong>87</strong></div>
              <div><span>UPDATED</span><strong>just now</strong></div>
            </div>
            <p className="critical-copy"><strong>Recommended action:</strong> Begin evacuation toward your assigned safe destination immediately.</p>
            <button type="button" className="critical-guide" onClick={openGuide}>GUIDE ME</button>
            <div className="critical-actions">
              <button type="button" className="critical-help" onClick={requestHelp}>I NEED HELP</button>
              <button type="button" className="critical-details" onClick={() => setShowCriticalAlert(false)}>View Details</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
