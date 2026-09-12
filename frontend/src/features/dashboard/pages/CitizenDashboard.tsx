import { useMemo, useState } from 'react';
import { authSession } from '../../auth/auth-session';

const riskCards = [
  { label: 'Flood risk', value: 'HIGH', meta: 'River level rising', tone: 'danger' },
  { label: 'Rainfall', value: '78 mm', meta: 'Last 6 hours', tone: 'neutral' },
  { label: 'Nearest safe zone', value: '1.8 km', meta: 'Community Hall B', tone: 'safe' },
  { label: 'Road status', value: '2 blocked', meta: 'Route updated', tone: 'warning' },
];

export default function CitizenDashboard() {
  const session = authSession.get();
  const [sosSent, setSosSent] = useState(false);

  const firstName = useMemo(() => {
    const name = session?.user.name?.trim() || 'Citizen';
    return name.split(' ')[0];
  }, [session?.user.name]);

  const signOut = () => {
    authSession.clear();
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <main className="citizen-shell">
      <header className="citizen-topbar">
        <div>
          <div className="citizen-brand">G-0ne</div>
          <p>Citizen safety workspace</p>
        </div>
        <div className="citizen-topbar-actions">
          <span className="live-pill"><i /> Live monitoring</span>
          <button type="button" className="ghost-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="citizen-hero">
        <div>
          <p className="citizen-kicker">GOOD MORNING, {firstName.toUpperCase()}</p>
          <h1>Your area is under a <span>high flood warning.</span></h1>
          <p className="citizen-lead">G-0ne is monitoring rainfall, river levels, road closures, and nearby safe zones to help you make the safest next move.</p>
        </div>
        <div className="risk-badge">
          <span>Risk level</span>
          <strong>HIGH</strong>
          <small>Updated just now</small>
        </div>
      </section>

      <section className="citizen-stats" aria-label="Current flood conditions">
        {riskCards.map((card) => (
          <article key={card.label} className={`citizen-stat citizen-stat--${card.tone}`}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <span>{card.meta}</span>
          </article>
        ))}
      </section>

      <section className="citizen-grid">
        <article className="dashboard-card warning-card">
          <div className="card-heading-row">
            <div>
              <span className="section-label">ACTIVE WARNING</span>
              <h2>Flash flood risk increasing</h2>
            </div>
            <span className="severity-chip">HIGH</span>
          </div>
          <p className="card-copy">Heavy rainfall upstream is causing rapid water-level increases. Low-lying roads may become unsafe with little notice.</p>
          <div className="warning-details">
            <div><span>Expected impact</span><strong>Next 30–60 min</strong></div>
            <div><span>Primary concern</span><strong>Road flooding</strong></div>
            <div><span>Recommended action</span><strong>Prepare to evacuate</strong></div>
          </div>
          <button type="button" className="secondary-button">View warning details</button>
        </article>

        <article className="dashboard-card safe-zone-card">
          <span className="section-label">BEST SAFE ZONE</span>
          <h2>Community Hall B</h2>
          <p className="safe-zone-distance">1.8 km away · about 6 min</p>
          <div className="capacity-row">
            <div><span>Capacity</span><strong>62%</strong></div>
            <div className="capacity-track"><span /></div>
          </div>
          <ul className="facility-list">
            <li>Medical support</li>
            <li>Food & water</li>
            <li>Backup power</li>
          </ul>
          <button type="button" className="primary-button">Start evacuation route →</button>
        </article>

        <article className="dashboard-card map-card">
          <div className="card-heading-row">
            <div>
              <span className="section-label">LIVE SAFETY MAP</span>
              <h2>Route conditions around you</h2>
            </div>
            <button type="button" className="text-button">Open full map</button>
          </div>
          <div className="demo-map" role="img" aria-label="Demo map showing flood zones, user location, safe zone and blocked roads">
            <div className="map-river" />
            <div className="flood-zone flood-zone-a" />
            <div className="flood-zone flood-zone-b" />
            <div className="route-line" />
            <span className="map-marker user-marker">You</span>
            <span className="map-marker shelter-marker">Safe zone</span>
            <span className="map-marker blocked-marker">Blocked</span>
          </div>
          <div className="map-legend">
            <span><i className="legend-dot legend-user" />Your location</span>
            <span><i className="legend-dot legend-flood" />Flood risk</span>
            <span><i className="legend-dot legend-safe" />Safe zone</span>
          </div>
        </article>

        <article className="dashboard-card sos-card">
          <span className="section-label">EMERGENCY HELP</span>
          <h2>{sosSent ? 'Help request sent' : 'Need rescue or urgent assistance?'}</h2>
          <p className="card-copy">{sosSent ? 'Your location and account details have been attached to the request. An emergency worker can now assign a responder.' : 'Send your location to the emergency queue if you are trapped, injured, or cannot safely evacuate.'}</p>
          {sosSent ? (
            <div className="sos-status">
              <span className="status-pulse" />
              <div><strong>Request received</strong><small>Waiting for responder assignment</small></div>
            </div>
          ) : (
            <button type="button" className="sos-button" onClick={() => setSosSent(true)}>Send SOS request</button>
          )}
          <p className="demo-note">Demo mode: no real emergency service is contacted.</p>
        </article>
      </section>
    </main>
  );
}
