import { adminDashboardApi, type AdminDashboardOverview, type DistrictId, type DistrictOperations, type RiskBand } from './api/admin-dashboard.api';

let overview: AdminDashboardOverview | null = null;
let selectedDistrict: DistrictId = 'sindhupalchok';
let mode: 'global' | 'district' = 'global';
let busy = false;

const districtOrder: DistrictId[] = ['sindhupalchok', 'rautahat', 'chitwan', 'kathmandu'];

function riskClass(band: RiskBand) { return `risk-${band}`; }
function pct(v: number) { return `${Math.max(0, Math.min(100, Math.round(v)))}%`; }
function escapeHtml(value: unknown) { return String(value ?? '').replace(/[&<>'"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m] || m)); }

function dashboardHost() {
  return document.querySelector<HTMLElement>('.command-center-static-view');
}

function navIsDashboard() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.ops-nav button')).some((b) => b.classList.contains('active') && b.querySelector('span')?.textContent?.trim() === 'Dashboard');
}

function mapSvg(districts: AdminDashboardOverview['districts']) {
  const d = new Map(districts.map((x) => [x.id, x]));
  const fill = (id: DistrictId) => {
    const band = d.get(id)?.riskBand ?? 'low';
    return band === 'critical' ? '#f4c2bd' : band === 'high' ? '#f5d3b2' : band === 'moderate' ? '#ead6a7' : '#d9eadc';
  };
  const stroke = (id: DistrictId) => d.get(id)?.riskBand === 'critical' ? '#d9534f' : '#d6a25d';
  return `<svg class="admin-nepal-map" viewBox="0 0 720 300" role="img" aria-label="Interactive Nepal district risk map">
    <path class="country-shell" d="M45 190 L105 130 L190 112 L275 120 L355 98 L470 85 L600 115 L650 155 L650 220 L560 235 L445 230 L360 242 L250 230 L145 236 L45 220 Z" />
    <path data-district="rautahat" fill="${fill('rautahat')}" stroke="${stroke('rautahat')}" d="M205 205 L295 195 L315 225 L275 240 L190 235 L178 220 Z"/>
    <path data-district="chitwan" fill="${fill('chitwan')}" stroke="${stroke('chitwan')}" d="M285 160 L375 150 L402 185 L350 210 L300 202 L275 182 Z"/>
    <path data-district="kathmandu" fill="${fill('kathmandu')}" stroke="${stroke('kathmandu')}" d="M330 115 L390 104 L420 145 L382 165 L340 153 Z"/>
    <path data-district="sindhupalchok" fill="${fill('sindhupalchok')}" stroke="${stroke('sindhupalchok')}" d="M405 95 L490 84 L525 115 L512 168 L462 184 L415 160 L395 132 Z"/>
    <text x="220" y="224">Rautahat</text><text x="318" y="184">Chitwan</text><text x="350" y="137">Kathmandu</text><text x="432" y="136">Sindhupalchok</text>
  </svg>`;
}

function globalHtml(data: AdminDashboardOverview) {
  const ranked = [...data.districts].sort((a,b) => b.riskScore - a.riskScore);
  const t = data.riskTrend;
  const trendPoints = t.map((p,i) => `${20 + i * 120},${100 - p.value * .7}`).join(' ');
  return `<div class="admin-dash" data-admin-dashboard>
    <header class="admin-dash-header"><div><h1>Dashboard</h1><p>Nepal Flood Intelligence · <span>${new Date(data.updatedAt).toLocaleString()}</span></p></div><div class="view-toggle"><button class="active" data-mode="global">GLOBAL VIEW</button><button data-mode="district">DISTRICT VIEW</button><span class="live-pill">● ${data.source === 'live' ? 'LIVE' : 'HYBRID'}</span></div></header>
    <section class="admin-section-title"><div><span>NATIONAL OPERATIONS OVERVIEW</span><h2>National Operations Overview <b>● LIVE</b></h2><p>${data.source === 'hybrid' ? 'Live emergency backend + modeled district operations data' : 'Live backend operations data'}</p></div></section>
    <section class="admin-metrics"><article><span>CRITICAL DISTRICTS</span><strong class="red">${data.criticalDistricts}</strong><small>Require immediate response</small></article><article><span>ACTIVE INCIDENTS</span><strong class="orange">${data.activeIncidents}</strong><small>Across tracked districts</small></article><article><span>PEOPLE AT RISK</span><strong>${data.peopleAtRisk.toLocaleString()}</strong><small>Tracked from active incidents / hybrid model</small></article><article><span>ACTIVE RESPONDERS</span><strong class="green">${data.activeResponders}</strong><small>Assigned or deployed</small></article></section>
    <section class="global-grid"><article class="national-map-card"><div class="card-kicker">NATIONAL RISK MAP</div><strong id="map-instruction">Click a district to view operations</strong><div class="risk-legend"><span>□ LOW</span><span>□ MODERATE</span><span>□ HIGH</span><span>□ CRITICAL</span></div>${mapSvg(data.districts)}</article>
      <aside class="highest-risk"><div class="card-kicker">HIGHEST RISK</div>${ranked.map((x,i)=>`<button data-open-district="${x.id}"><div><span>${i+1}.</span><strong>${escapeHtml(x.name)}</strong><b class="${riskClass(x.riskBand)}">${x.riskBand.toUpperCase()}</b></div><div><em>${x.riskScore} / 100</em><small>${x.incidentCount} incidents</small></div><i><u style="width:${x.riskScore}%"></u></i></button>`).join('')}</aside>
    </section>
    <section class="bottom-grid"><article class="trend-card"><div class="card-kicker">NATIONAL RISK TREND</div><strong>Risk evolution over recent hours</strong><svg viewBox="0 0 520 125" class="trend-svg"><polyline points="${trendPoints}"/><g>${t.map((p,i)=>`<circle cx="${20+i*120}" cy="${100-p.value*.7}" r="4"/><text x="${20+i*120}" y="120">${p.label}</text><text x="${20+i*120}" y="${92-p.value*.7}">${p.value}</text>`).join('')}</g></svg></article><article class="capacity-card"><div class="card-kicker">SAFE-ZONE NETWORK</div><strong>National capacity summary</strong><div class="capacity-grid"><div><span>Total Capacity</span><b>${data.safeZoneCapacity.total.toLocaleString()}</b></div><div><span>Assigned Evacuees</span><b class="orange">${data.safeZoneCapacity.assigned.toLocaleString()}</b></div><div><span>Available</span><b class="green">${data.safeZoneCapacity.available.toLocaleString()}</b></div><div><span>Overall Load</span><b>${data.safeZoneCapacity.loadPercent}%</b></div></div></article></section>
  </div>`;
}

function districtMapHtml(d: DistrictOperations) {
  return `<div class="district-map-stage"><div class="district-zone critical-zone"></div><div class="district-zone high-zone"></div>
    ${d.incidents.slice(0,4).map((x,i)=>`<button class="incident-dot dot-${i}" title="${x.id} ${x.type}">${x.type === 'rescue' ? 'T' : x.type === 'medical' ? 'M' : 'E'}</button>`).join('')}
    ${d.responders.slice(0,2).map((x,i)=>`<span class="responder-dot responder-${i}" title="${escapeHtml(x.name)}">R</span>`).join('')}
    <span class="safe-zone-dot">✚</span><div class="district-map-legend"><span>--- Critical Zone</span><span>--- High-Risk Area</span><span>● SOS / Incident</span><span>● Safe Zone</span><span>● Responder</span></div>
  </div>`;
}

function districtHtml(d: DistrictOperations) {
  const available = d.responders.filter(r=>r.status==='available').length;
  const assigned = d.responders.filter(r=>r.status==='assigned').length;
  const enRoute = d.responders.filter(r=>r.status==='en_route').length;
  return `<div class="admin-dash district-view" data-admin-dashboard>
    <header class="admin-dash-header"><div><h1>Dashboard</h1><p>Nepal Flood Intelligence · District Operations</p></div><div class="view-toggle"><button data-mode="global">GLOBAL VIEW</button><button class="active" data-mode="district">DISTRICT VIEW</button><span class="live-pill">● HYBRID</span></div></header>
    <section class="district-picker"><div><span>DISTRICT OPERATIONS</span><select data-district-select>${districtOrder.map(id=>`<option value="${id}" ${id===d.id?'selected':''}>${overview?.districts.find(x=>x.id===id)?.name ?? id}</option>`).join('')}</select><b class="${riskClass(d.riskBand)}">${d.riskBand.toUpperCase()}</b><small>● LIVE · updated just now</small></div></section>
    <section class="district-metrics"><article><span>FLOOD RISK</span><strong class="red">${d.riskScore}/100</strong><small>${d.riskBand.toUpperCase()}</small></article><article><span>PEOPLE AT RISK</span><strong>${d.peopleAtRisk}</strong><small>Tracked via incident + hybrid model</small></article><article><span>ACTIVE INCIDENTS</span><strong class="red">${d.incidentCount}</strong><small>Open right now</small></article><article><span>RESPONDERS</span><strong class="green">${d.activeResponders}</strong><small>In the field</small></article><article><span>SAFE-ZONE LOAD</span><strong>${d.safeZoneLoad}%</strong><small>Utilization</small></article></section>
    <section class="district-main-grid"><article class="district-ops-card"><div class="card-row"><div><span>LIVE DISTRICT OPERATIONS</span><strong>${escapeHtml(d.name)} · Operational View</strong></div><b>● LIVE</b></div><div class="map-layer-tabs"><button class="active">Risk Areas</button><button>Incidents</button><button>Safe Zones</button><button>Responders</button><button>Routes</button></div>${districtMapHtml(d)}</article>
      <aside class="district-queue"><div class="card-kicker">EMERGENCY QUEUE</div><div class="queue-filter-row"><button class="active">All</button><button>Critical</button><button>Unassigned</button><button>Assigned</button></div>${d.incidents.map(x=>`<article class="district-incident ${riskClass(x.priority)}"><div><b class="${riskClass(x.priority)}">${x.priority.toUpperCase()}</b><strong>${escapeHtml(x.id)}</strong></div><h4>${x.type==='rescue'?'TRAPPED':x.type.toUpperCase()}</h4><p>${x.people} ${x.people===1?'person':'people'}</p><div><small>Location age<br><b>${x.ageLabel}</b></small><small>Accuracy<br><b>${x.accuracyLabel}</b></small><small>Risk<br><b>${x.risk}</b></small></div></article>`).join('')}</aside>
    </section>
    <section class="district-bottom-grid"><article class="risk-intel"><div class="card-kicker">DISTRICT RISK INTELLIGENCE</div><div class="risk-gauge"><div class="gauge-circle"><strong>${d.riskScore}</strong><small>/100</small></div><div><b>Flood Risk</b><h3>${d.riskScore} / 100 · ${d.riskBand.toUpperCase()}</h3><span>CONTRIBUTING FACTORS</span>${d.factors.map(f=>`<div class="factor"><label>${escapeHtml(f.label)} <b>${f.value}</b></label><i><u style="width:${f.value}%"></u></i></div>`).join('')}</div></div></article>
      <article class="safe-zone-ops"><div class="card-kicker">SAFE-ZONE OPERATIONS</div>${d.safeZones.map(z=>{const load=Math.round(z.occupancy/z.capacity*100);return `<div class="safe-zone-row"><div><strong>${escapeHtml(z.name)}</strong><small>${z.distanceLabel}</small></div><b class="zone-${z.status}">${z.status.replace('_',' ').toUpperCase()}</b><span>${z.occupancy} / ${z.capacity}</span><i><u style="width:${load}%"></u></i><em>${load}%</em></div>`}).join('')}</article>
      <aside class="responder-status"><div class="card-kicker">RESPONDER STATUS</div><div class="responder-metrics"><div><span>ACTIVE</span><b>${d.activeResponders}</b></div><div><span>AVAILABLE</span><b class="green">${available}</b></div><div><span>ASSIGNED</span><b>${assigned}</b></div><div><span>EN ROUTE</span><b class="orange">${enRoute}</b></div></div>${d.responders.map(r=>`<div class="responder-row"><strong>${escapeHtml(r.name)}</strong><b class="status-${r.status}">${r.status.replace('_',' ').toUpperCase()}</b>${r.incidentId?`<small>Incident ${escapeHtml(r.incidentId)}</small>`:''}</div>`).join('')}</aside>
    </section>
  </div>`;
}

async function renderGlobal() {
  const host = dashboardHost(); if (!host || busy) return; busy = true;
  try { overview = await adminDashboardApi.getOverview(); mode='global'; host.innerHTML = globalHtml(overview); wire(); }
  finally { busy=false; }
}

async function renderDistrict(id: DistrictId) {
  const host = dashboardHost(); if (!host || busy) return; busy=true;
  try { const d = await adminDashboardApi.getDistrict(id); selectedDistrict=id; mode='district'; host.innerHTML = districtHtml(d); wire(); }
  finally { busy=false; }
}

function wire() {
  const root = document.querySelector<HTMLElement>('[data-admin-dashboard]'); if (!root) return;
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(btn=>btn.addEventListener('click',()=> btn.dataset.mode==='global'?void renderGlobal():void renderDistrict(selectedDistrict)));
  root.querySelectorAll<SVGElement>('[data-district]').forEach(el=>{
    el.addEventListener('mouseenter',()=>{const txt=document.getElementById('map-instruction'); if(txt) txt.textContent=`Hover: ${overview?.districts.find(d=>d.id===el.getAttribute('data-district'))?.name ?? ''}`;});
    el.addEventListener('mouseleave',()=>{const txt=document.getElementById('map-instruction'); if(txt) txt.textContent='Click a district to view operations';});
    el.addEventListener('click',()=>void renderDistrict(el.getAttribute('data-district') as DistrictId));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-open-district]').forEach(btn=>btn.addEventListener('click',()=>void renderDistrict(btn.dataset.openDistrict as DistrictId)));
  root.querySelector<HTMLSelectElement>('[data-district-select]')?.addEventListener('change',(e)=>void renderDistrict((e.currentTarget as HTMLSelectElement).value as DistrictId));
}

function boot() {
  const observer = new MutationObserver(()=>{
    if (!navIsDashboard()) return;
    const host = dashboardHost();
    if (!host || host.querySelector('[data-admin-dashboard]')) return;
    window.setTimeout(()=>void (mode==='global'?renderGlobal():renderDistrict(selectedDistrict)),0);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',(e)=>{
    const btn=(e.target as HTMLElement).closest<HTMLButtonElement>('.ops-nav button');
    if (btn?.querySelector('span')?.textContent?.trim()==='Dashboard') window.setTimeout(()=>void renderGlobal(),20);
  },true);
}

if (typeof window !== 'undefined') boot();
