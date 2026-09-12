import { citizenSafetyApi, type EmergencyRecord, type EvacuationRoute, type SafetyContext } from './api/citizen-safety.api';

type Message = { role: 'assistant' | 'user'; text: string };
type SpeechRecognitionCtor = new () => any;

let latestRoute: EvacuationRoute | null = null;
let latestSafety: SafetyContext | null = null;
let latestEmergency: EmergencyRecord | null = null;
let messages: Message[] = [];
let voiceEnabled = false;
let listening = false;
let crisisMode = false;
let lastLocationKey = '';
let refreshTimer: number | null = null;

function navButton(label: string): HTMLButtonElement | null {
  return [...document.querySelectorAll<HTMLButtonElement>('.figma-nav button')]
    .find((button) => button.textContent?.trim().includes(label)) ?? null;
}

function locationLabel() {
  const raw = document.querySelector<HTMLElement>('.location-line')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return raw.replace(/^⌖\s*/, '').replace(/\s*·\s*LIVE\s*$/, '').trim() || 'your current area';
}

function getCurrentPosition(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
    enableHighAccuracy: true,
    timeout: 4500,
    maximumAge: 15000,
  }));
}

async function refreshContext() {
  const position = await getCurrentPosition();
  if (position) {
    const key = `${position.coords.latitude.toFixed(3)},${position.coords.longitude.toFixed(3)}`;
    if (key !== lastLocationKey || !latestSafety) {
      lastLocationKey = key;
      try { latestSafety = await citizenSafetyApi.getContext(position.coords.latitude, position.coords.longitude); } catch { /* keep prior context */ }
    }
  }
  try {
    const emergencies = await citizenSafetyApi.listEmergencies();
    const live = emergencies.filter((item) => !item.is_demo && item.status !== 'cancelled');
    latestEmergency = live.sort((a,b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at))[0] ?? null;
  } catch { /* non-blocking */ }
}

function speak(text: string) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = crisisMode ? 0.9 : 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function contextSummary() {
  const risk = latestSafety ? `${latestSafety.prototype_risk_level.toUpperCase()} (${latestSafety.prototype_risk_score}/100)` : 'not available yet';
  const route = latestRoute ? `${latestRoute.destination_name}, ${Math.max(1, Math.round(latestRoute.duration_s / 60))} min away` : 'not calculated yet';
  const response = latestEmergency ? latestEmergency.status.replace('_',' ') : 'none active';
  return { risk, route, response };
}

function safeReply(input: string): string {
  const text = input.toLowerCase();
  const place = locationLabel();
  const risk = latestSafety;
  const route = latestRoute;
  const emergency = latestEmergency;

  const distress = /(scared|panic|afraid|terrified|shaking|overwhelmed|flood water|went through|in the water|stuck|trapped)/i.test(text);
  if (distress) crisisMode = true;

  if (/(can't evacuate|cannot evacuate|stuck|trapped|need rescue|need help)/i.test(text)) {
    return `Stay where you are if moving would put you in more danger. I can open Emergency Help now so your GPS and safety context can be shared with responders. Keep your phone available and avoid entering moving floodwater.`;
  }

  if (/(medical|hurt|injured|sick)/i.test(text)) {
    return `I can take you to Emergency Help so you can request medical assistance and share your location. If the situation feels immediately life-threatening, use local emergency services as well.`;
  }

  if (/(scared|panic|afraid|terrified|shaking|overwhelmed)/i.test(text)) {
    const routeLine = route ? `Your current recommended destination is ${route.destination_name}.` : 'I can help you open the safety map and find a route.';
    return `I’m with you. Focus on one thing at a time. ${routeLine} I can give you short directions, read them aloud, and help you contact a responder if you cannot move safely.`;
  }

  if (/(am i safe|my risk|risk right now|safe right now)/i.test(text)) {
    if (!risk) return `I don't have a fresh risk reading yet. Use your location on the Live Map and I can interpret the current rainfall, river, and route context.`;
    return `Your current JalRakshak model is ${risk.prototype_risk_level.toUpperCase()} risk at ${risk.prototype_risk_score}/100 near ${place}. Rain expected in the next 6 hours is ${risk.precipitation_next_6h_mm.toFixed(1)} mm. This is a modeled safety estimate, not an official emergency warning.`;
  }

  if (/(rain|raining|weather|dangerous rain)/i.test(text)) {
    if (!risk) return `I don't have the latest weather context yet. Open the Live Map or enable location and I’ll check it.`;
    return `The current feed shows ${risk.precipitation_next_6h_mm.toFixed(1)} mm of rain over the next 6 hours${risk.precipitation_probability_max_6h != null ? ` with up to ${risk.precipitation_probability_max_6h}% probability` : ''}. River discharge is ${risk.river_discharge_m3s != null ? `${risk.river_discharge_m3s.toFixed(1)} cubic meters per second` : 'not available'}.`;
  }

  if (/(where.*evacuate|nearest safe|safe place|where should i go|destination)/i.test(text)) {
    if (!route) return `A route hasn't been calculated yet. I can open the Live Map, use your current location, and help you find a nearby destination.`;
    return `Your current recommended destination is ${route.destination_name}, about ${formatDistance(route.distance_m)} away with an estimated travel time of ${Math.max(1, Math.round(route.duration_s / 60))} minutes.`;
  }

  if (/(why.*route|explain.*route|why.*chosen|route chosen)/i.test(text)) {
    if (!route) return `There isn't an active route to explain yet. Calculate one on the Live Map first.`;
    const counts = route.screening_status === 'complete' ? ` ${route.rejected_count ?? 0} were rejected and ${route.viable_count ?? 0} remained viable.` : '';
    const reasons = route.reasons?.slice(0,2).join(' ') || 'It ranked highest among the available road options.';
    return `JalRakshak compared ${route.alternatives_considered} route options.${counts} The selected route goes to ${route.destination_name}. ${reasons}`;
  }

  if (/(route changed|reroute|still safe|route update)/i.test(text)) {
    if (!route) return `No current route is loaded. Open the Live Map to calculate one.`;
    return `Your recommended route is still ${route.destination_name}. JalRakshak currently shows ${route.alternatives_considered} analyzed option${route.alternatives_considered === 1 ? '' : 's'}. If your GPS or hazard context changes, recalculate before continuing.`;
  }

  if (/(responder|sos|help.*way|response status)/i.test(text)) {
    if (!emergency) return `I don't see an active citizen SOS right now. If you need help, I can open Emergency Help.`;
    const responder = emergency.responder_name ? ` ${emergency.responder_name} is assigned.` : '';
    return `Your latest SOS is ${emergency.status.replace('_',' ')}.${responder}`;
  }

  if (/(guide me|directions|navigate|take me there)/i.test(text)) {
    if (!route) return `I can open the Live Map so we can calculate a route from your current location first.`;
    const first = route.steps?.[0]?.instruction;
    return `I can guide you to ${route.destination_name}. ${first ? `First: ${first}.` : ''} Open guidance and I’ll keep the directions short and readable aloud.`;
  }

  const summary = contextSummary();
  return `I can help with your risk, weather, safest route, responder status, or emergency assistance. Right now your modeled risk is ${summary.risk}, your route is ${summary.route}, and responder status is ${summary.response}.`;
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} kilometers` : `${Math.round(meters)} meters`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] ?? char));
}

function renderMessages() {
  return messages.map((message) => `<div class="ai-message ${message.role}"><div class="ai-bubble">${escapeHtml(message.text)}</div></div>`).join('');
}

function quickActions() {
  return [
    ['risk','My risk'],['route','Safest route'],['explain','Explain route'],['weather','Weather update'],
    ['responder','Responder status'],['scared',"I'm scared"],['stuck',"I'm stuck"],['medical','Medical help'],
    ['guide','Guide me'],['help','Emergency SOS'],
  ].map(([key,label]) => `<button type="button" data-ai-quick="${key}">${label}</button>`).join('');
}

function renderAssistant(section: HTMLElement) {
  if (!messages.length) {
    messages = [{ role:'assistant', text:'I’m JalRakshak Safety Assistant. I can use your live risk, route, weather, and responder context. You can type or use the microphone.' }];
  }
  section.className = `citizen-ai-screen ${crisisMode ? 'crisis-mode' : ''}`;
  section.innerHTML = `
    <div class="ai-header">
      <div><span class="safe-eyebrow">JALRAKSHAK ASSISTANT</span><h1>${crisisMode ? 'I’m here with you' : 'Safety guidance, in context'}</h1><p>${crisisMode ? 'Short, calm guidance with one action at a time.' : 'Ask about your current risk, route, weather, destination, or responder status.'}</p></div>
      <button type="button" class="ai-voice-toggle ${voiceEnabled ? 'active' : ''}" data-ai-voice>${voiceEnabled ? '🔊 Voice on' : '🔈 Voice off'}</button>
    </div>
    <div class="ai-context-strip">
      <span><b>RISK</b>${latestSafety ? `${latestSafety.prototype_risk_score}/100 · ${latestSafety.prototype_risk_level.toUpperCase()}` : 'Checking…'}</span>
      <span><b>DESTINATION</b>${latestRoute?.destination_name ?? 'No route yet'}</span>
      <span><b>RESPONDER</b>${latestEmergency ? latestEmergency.status.replace('_',' ').toUpperCase() : 'No active SOS'}</span>
    </div>
    <div class="ai-layout">
      <section class="ai-chat-card">
        <div class="ai-messages" aria-live="polite">${renderMessages()}</div>
        <div class="ai-quick-actions">${quickActions()}</div>
        <form class="ai-input-row">
          <button type="button" class="ai-mic ${listening ? 'listening' : ''}" data-ai-mic aria-label="Use voice input">${listening ? '■' : '🎙'}</button>
          <input type="text" data-ai-input placeholder="Ask JalRakshak…" autocomplete="off" />
          <button type="submit" class="ai-send">Send</button>
        </form>
        <div class="ai-disclaimer">Safety assistant uses JalRakshak context. GPS, routing, hazard screening, and SOS actions remain deterministic app systems.</div>
      </section>
      <aside class="ai-action-panel">
        <span class="safe-eyebrow">QUICK SAFETY ACTIONS</span>
        <button type="button" data-ai-nav="map" class="ai-action-primary">🧭 Open Live Map</button>
        <button type="button" data-ai-nav="guide">🔊 Start voice guidance</button>
        <button type="button" data-ai-nav="help" class="ai-action-danger">⊙ I need emergency help</button>
        ${crisisMode ? '<div class="ai-crisis-note"><strong>One step at a time</strong><p>You do not need to solve everything at once. I can keep directions short and read them aloud.</p></div>' : ''}
      </aside>
    </div>`;

  wireAssistant(section);
  window.setTimeout(() => {
    const box = section.querySelector<HTMLElement>('.ai-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }, 0);
}

function addUserMessage(section: HTMLElement, text: string) {
  const cleaned = text.trim();
  if (!cleaned) return;
  messages.push({ role:'user', text: cleaned });
  const reply = safeReply(cleaned);
  messages.push({ role:'assistant', text: reply });
  renderAssistant(section);
  speak(reply);
}

function startVoice(section: HTMLElement) {
  const win = window as any;
  const Recognition = (win.SpeechRecognition || win.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
  if (!Recognition) {
    messages.push({ role:'assistant', text:'Voice input is not supported in this browser. You can still type, and voice playback may still work.' });
    renderAssistant(section);
    return;
  }
  const recognition = new Recognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;
  listening = true;
  renderAssistant(section);
  recognition.onresult = (event: any) => {
    const text = event.results?.[0]?.[0]?.transcript ?? '';
    listening = false;
    addUserMessage(section, text);
  };
  recognition.onerror = () => { listening = false; renderAssistant(section); };
  recognition.onend = () => { if (listening) { listening = false; renderAssistant(section); } };
  recognition.start();
}

function openMap(startGuide = false) {
  navButton('Live Map')?.click();
  if (startGuide) window.setTimeout(() => document.querySelector<HTMLButtonElement>('.route-start:not(:disabled)')?.click(), 500);
}

function wireAssistant(section: HTMLElement) {
  section.querySelector<HTMLFormElement>('.ai-input-row')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = section.querySelector<HTMLInputElement>('[data-ai-input]');
    if (input) addUserMessage(section, input.value);
  });
  section.querySelector<HTMLButtonElement>('[data-ai-mic]')?.addEventListener('click', () => startVoice(section));
  section.querySelector<HTMLButtonElement>('[data-ai-voice]')?.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    if (!voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    renderAssistant(section);
  });
  section.querySelectorAll<HTMLButtonElement>('[data-ai-quick]').forEach((button) => button.addEventListener('click', () => {
    const prompts: Record<string,string> = {
      risk:'Am I safe right now?', route:'Where should I evacuate?', explain:'Why did you choose this route?', weather:'Is the rain dangerous right now?',
      responder:'What is my responder status?', scared:"I'm scared and I need you to stay with me.", stuck:"I'm stuck and I can't evacuate.", medical:'I need medical help.', guide:'Guide me to safety.', help:"I can't evacuate and need help.",
    };
    addUserMessage(section, prompts[button.dataset.aiQuick ?? ''] ?? button.textContent ?? '');
  }));
  section.querySelector<HTMLButtonElement>('[data-ai-nav="map"]')?.addEventListener('click', () => openMap(false));
  section.querySelector<HTMLButtonElement>('[data-ai-nav="guide"]')?.addEventListener('click', () => { voiceEnabled = true; openMap(true); });
  section.querySelector<HTMLButtonElement>('[data-ai-nav="help"]')?.addEventListener('click', () => navButton('Emergency Help')?.click());
}

function maybeEnhanceAssistant() {
  const placeholder = document.querySelector<HTMLElement>('.figma-placeholder-panel');
  if (placeholder?.querySelector('h2')?.textContent?.trim() === 'AI Assistant') {
    void refreshContext().finally(() => renderAssistant(placeholder));
    if (refreshTimer == null) refreshTimer = window.setInterval(() => void refreshContext().then(() => {
      const screen = document.querySelector<HTMLElement>('.citizen-ai-screen');
      if (screen) renderAssistant(screen);
    }), 12000);
    return;
  }
  if (!document.querySelector('.citizen-ai-screen') && refreshTimer != null) {
    window.clearInterval(refreshTimer); refreshTimer = null;
  }
}

window.addEventListener('jalrakshak:route-analysis', (event) => {
  latestRoute = (event as CustomEvent<EvacuationRoute>).detail;
  const screen = document.querySelector<HTMLElement>('.citizen-ai-screen');
  if (screen) renderAssistant(screen);
});
window.addEventListener('online', maybeEnhanceAssistant);
window.addEventListener('load', maybeEnhanceAssistant);
const observer = new MutationObserver(() => maybeEnhanceAssistant());
observer.observe(document.documentElement, { childList:true, subtree:true });
maybeEnhanceAssistant();
