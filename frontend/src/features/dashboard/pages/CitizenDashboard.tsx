import { useMemo, useState } from 'react';
import { authSession } from '../../auth/auth-session';
import './CitizenDashboard.css';

type NavItem = 'Overview' | 'Live Map' | 'Alerts' | 'AI Assistant' | 'Emergency Help' | 'Recovery';

type BrowserLocation = {
  latitude: number;
  longitude: number;
} | null;

const navItems: Array<{ label: NavItem; icon: string; badge?: number; muted?: boolean }> = [
  { label: 'Overview', icon: '▦' },
  { label: 'Live Map', icon: '◫' },
  { label: 'Alerts', icon: '♢', badge: 2 },
  { label: 'AI Assistant', icon: '▤' },
  { label: 'Emergency Help', icon: '⊙' },
  { label: 'Recovery', icon: '◷', muted: true },
];

const DEMO_CENTER = { latitude: 27.9516, longitude: 85.6846 };

export default function CitizenDashboard() {
  const session = authSession.get();
  const [activeNav, setActiveNav] = useState<NavItem>('Overview');
  const [showCriticalAlert, setShowCriticalAlert] = useState(true);
  const [helpRequested, setHelpRequested] = useState(false);
  const [browserLocation, setBrowserLocation] = useState<BrowserLocation>(null);
  const [locationStatus, setLocationStatus] = useState('Demo location');

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
  const mapEmbedUrl = useMemo(() => {
    const { latitude, longitude } = mapCenter;
    const latSpan = 0.018;
    const lonSpan = 0.028;
    const bbox = `${longitude - lonSpan},${latitude - latSpan},${longitude + lonSpan},${latitude + latSpan}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  }, [mapCenter.latitude, mapCenter.longitude]);

  const signOut = () => {
    authSession.clear();
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const requestHelp = () => {
    setHelpRequested(true);
    setShowCriticalAlert(false);
    setActiveNav('Emergency Help');
  };

  const openGuide = () => {
    setShowCriticalAlert(false);
    setActiveNav('Live Map');
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
    <section className="live-map-screen">
      <div className="map-page-heading">
        <div>
          <span className="safe-eyebrow">LIVE SAFETY MAP</span>
          <h1>Safest route around you</h1>
          <p>Map tiles are live from OpenStreetMap. Flood zones, closures, and the evacuation recommendation are demo overlays until the live data feeds are connected.</p>
        </div>
        <button type="button" className="location-button" onClick={useMyLocation}>⌖ Use my location</button>
      </div>

      <div className="map-status-row">
        <span><i className="status-dot green" /> {locationStatus}</span>
        <span><i className="status-dot red" /> Critical flood zone nearby</span>
        <span><i className="status-dot gold" /> 2 road closures</span>
      </div>

      <div className="map-layout">
        <div className="map-panel">
          <iframe
            className="osm-map"
            title="JalRakshak live safety map"
            src={mapEmbedUrl}
            loading="lazy"
          />
          <div className="map-overlay-card map-you">
            <strong>YOU</strong>
            <span>{mapCenter.latitude.toFixed(4)}, {mapCenter.longitude.toFixed(4)}</span>
          </div>
          <div className="map-overlay-card map-risk-legend">
            <span><i className="legend-swatch critical" /> Critical risk</span>
            <span><i className="legend-swatch route" /> Recommended route</span>
            <span><i className="legend-swatch safe" /> Safe destination</span>
          </div>
        </div>

        <aside className="route-panel">
          <span className="safe-eyebrow">RECOMMENDED EVACUATION</span>
          <h2>Shree Secondary School</h2>
          <div className="route-metrics">
            <div><strong>13 min</strong><span>ETA</span></div>
            <div><strong>920 m</strong><span>Distance</span></div>
            <div><strong>61%</strong><span>Capacity</span></div>
          </div>
          <div className="route-safety-note">
            <strong>✓ Route currently passable</strong>
            <p>Avoid the riverside road. The recommended path stays on higher ground and bypasses two reported closures.</p>
          </div>
          <div className="route-steps">
            <div><b>1</b><span><strong>Head north</strong><small>Continue for 280 m</small></span></div>
            <div><b>2</b><span><strong>Turn right at the market</strong><small>Stay on the upper road</small></span></div>
            <div><b>3</b><span><strong>Continue to the school</strong><small>Safe-zone entrance is on the east side</small></span></div>
          </div>
          <button type="button" className="figma-primary route-start">START GUIDANCE</button>
          <button type="button" className="figma-danger-button route-help" onClick={requestHelp}>I CAN'T EVACUATE — GET HELP</button>
        </aside>
      </div>

      <div className="map-bottom-cards">
        <article><span>🚧</span><div><strong>2 closures ahead</strong><small>Both excluded from recommended route</small></div></article>
        <article><span>🏫</span><div><strong>Safe zone accepting arrivals</strong><small>Demo capacity: 61%</small></div></article>
        <article><span>📡</span><div><strong>Live map connected</strong><small>OpenStreetMap base layer</small></div></article>
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
