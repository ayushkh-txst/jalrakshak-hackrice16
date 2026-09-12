import { citizenSafetyApi, type EmergencyRecord, type EvacuationRoute, type SafetyContext } from './api/citizen-safety.api';
import { runNavCatAction, type NavCatAction } from './navcat-action-engine';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  createdAt: number;
  actions?: NavCatAction[];
};

type SpeechRecognitionCtor = new () => any;

const CHAT_HISTORY_KEY = 'jalrakshak:citizen-ai-history:v1';
const WELCOME_TEXT = 'Hi, I’m NavCat. I’m here to help you stay safe. I can check your current risk, find a safer place, guide you there, or help you reach emergency support. What can I help you with?';
const NAVCAT_OVERLAY_ID = 'jalrakshak-navcat-overlay';

let latestRoute: EvacuationRoute | null = null;
let latestSafety: SafetyContext | null = null;
let latestEmergency: EmergencyRecord | null = null;
let messages: Message[] = loadHistory();
let voiceEnabled = false;
let listening = false;
let crisisMode = false;
let lastLocationKey = '';
let refreshTimer: number | null = null;
let responsePending = false;

function createMessage(role: Message['role'], text: string, actions?: NavCatAction[]): Message {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text, actions, createdAt: Date.now() };
}

function loadHistory(): Message[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && (item.role === 'assistant' || item.role === 'user') && typeof item.text === 'string')
      .slice(-80);
  } catch {
    return [];
  }
}

function saveHistory() {
  try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-80))); } catch { /* storage unavailable */ }
}

function citizenName() {
  return document.querySelector<HTMLElement>('.sidebar-user strong')?.textContent?.trim() || 'there';
}

function locationLabel() {
  const raw = document.querySelector<HTMLElement>('.location-line')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return raw.replace(/^⌖\s*/, '').replace(/\s*·\s*LIVE\s*$/, '').trim() || 'your current area';
}

function getCurrentPosition(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    resolve,
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 4500, maximumAge: 15000 },
  ));
}

async function refreshContext() {
  const position = await getCurrentPosition();
  if (position) {
    const key = `${position.coords.latitude.toFixed(3)},${position.coords.longitude.toFixed(3)}`;
    if (key !== lastLocationKey || !latestSafety) {
      lastLocationKey = key;
      try { latestSafety = await citizenSafetyApi.getContext(position.coords.latitude, position.coords.longitude); } catch { /* retain last good */ }
    }
  }
  try {
    const records = await citizenSafetyApi.listEmerencies?.() ?? await citizenSafetyApi.listEmergencies();
    latestEmergency = records
      .filter((item) => !item.is_demo && item.status !== 'cancelled')
      .sort((a, b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at))[0] ?? null;
  } catch { /* retain last good */ }
}

function speak(text: string) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = crisisMode ? 0.92 : 1;
  window.speechSynthesis.speak(utterance);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char] ?? char));
}

function renderAction(action: NavCatAction, messageId: string, index: number) {
  if (action.kind === 'call') {
    return `<button type="button" class="navcat-result-action emergency" data-navcat-action="call" data-navcat-phone="${escapeHtml(action.phone)}" data-message="${escapeHtml(messageId)}-${index}">${escapeHtml(action.label)}</button>`;
  }
  return `<button type="button" class="navcat-result-action" data-navcat-action="${action.kind}" data-message="${escapeHtml(messageId)}-${index}">${escapeHtml(action.label)}</button>`;
}

function renderMessages() {
  const visible = messages.length ? messages : [createMessage('assistant', WELCOME_TEXT)];
  return visible.map((message) => `
    <div class="ai-message ${message.role}" data-message-id="${escapeHtml(message.id)}">
      <div class="ai-message-wrap">
        <div class="ai-bubble">
          <div>${escapeHtml(message.text)}</div>
          ${message.actions?.length ? `<div class="navcat-result-actions">${message.actions.map((action, index) => renderAction(action, message.id, index)).join('')}</div>` : ''}
        </div>
        ${messages.length ? `<button type="button" class="ai-delete-message" data-ai-delete="${escapeHtml(message.id)}" aria-label="Delete this message">×</button>` : ''}
      </div>
    </div>`).join('');
}

function quickActions() {
  const items = [
    ['risk', 'My risk'], ['route', 'Safest route'], ['explain', 'Explain route'], ['weather', 'Weather update'],
    ['responder', 'Responder status'], ['scared', "I'm scared"], ['stuck', "I'm stuck"], ['medical', 'Medical help'], ['guide', 'Guide me'],
  ];
  return items.map(([key, label]) => `<button type="button" data-ai-quick="${key}">${label}</button>`).join('');
}

function renderAssistant(section: HTMLElement) {
  const focused = document.activeElement?.matches?.('[data-ai-input]') ?? false;
  const draft = document.querySelector<HTMLInputElement>('[data-ai-input]')?.value ?? '';
  section.className = `citizen-ai-screen navcat-overlay-screen ${crisisMode ? 'crisis-mode' : ''}`;
  section.innerHTML = `
    <div class="ai-header">
      <div class="ai-history-controls"></div>
      <span class="ai-brand-label">NavCat</span>
    </div>
    <div class="ai-layout">
      <section class="ai-chat-card">
        <div class="ai-messages" aria-live="polite">${renderMessages()}${responsePending ? '<div class="navcat-thinking">NavCat is checking live safety data…</div>' : ''}</div>
        <div class="ai-quick-actions">${quickActions()}</div>
        <form class="ai-input-row">
          <span class="ai-chat-composer-label">💬 Chat</span>
          <button type="button" class="ai-mic ${listening ? 'listening' : ''}" data-ai-mic>${listening ? '■ Listening' : '🎙 Voice'}</button>
          <input type="text" data-ai-input placeholder="Ask NavCat…" autocomplete="off" value="${escapeHtml(draft)}" ${responsePending ? 'disabled' : ''}/>
          <button type="submit" class="ai-send" ${responsePending ? 'disabled' : ''}>Send</button>
        </form>
        <div class="ai-disclaimer">NavCat can interpret requests, but GPS, routing, hazard screening, emergency records, and hotline data come from validated JalRakshak systems.</div>
      </section>
    </div>`;

  wireAssistant(section);
  window.setTimeout(() => {
    const messageBox = section.querySelector<HTMLElement>('.ai-messages');
    if (messageBox) messageBox.scrollTop = messageBox.scrollHeight;
    const input = section.querySelector<HTMLInputElement>('[data-ai-input]');
    if (focused && input && !input.disabled) {
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch { /* unsupported */ }
    }
  }, 0);
}

function clickSidebarNav(label: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.figma-nav button'));
  const target = buttons.find((button) => button.textContent?.replace(/\s+/g, ' ').trim().includes(label));
  if (!target) return false;
  target.click();
  return true;
}

function executeResultAction(action: string, phone?: string) {
  if (action === 'emergency_help') {
    clickSidebarNav('Emergency Help');
    return;
  }
  if (action === 'open_map') {
    clickSidebarNav('Live Map');
    return;
  }
  if (action === 'call' && phone) {
    window.location.href = `tel:${phone}`;
  }
}

async function addUserMessage(section: HTMLElement, text: string) {
  const clean = text.trim();
  if (!clean || responsePending) return;

  messages.push(createMessage('user', clean));
  saveHistory();
  responsePending = true;
  renderAssistant(section);

  await refreshContext();
  const result = await runNavCatAction(clean, {
    userName: citizenName(),
    placeLabel: locationLabel(),
    latestRoute,
    latestSafety,
    latestEmergencyStatus: latestEmergency?.status ?? null,
    latestResponderName: latestEmergency?.responder_name ?? null,
  });

  if (result.route) latestRoute = result.route;
  crisisMode = Boolean(result.crisis);
  messages.push(createMessage('assistant', result.text, result.actions));
  saveHistory();
  responsePending = false;
  renderAssistant(section);
  speak(result.text);
}

function deleteMessage(section: HTMLElement, id: string) {
  messages = messages.filter((message) => message.id !== id);
  saveHistory();
  renderAssistant(section);
}

function startVoice(section: HTMLElement) {
  const browser = window as any;
  const Recognition = (browser.SpeechRecognition || browser.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
  if (!Recognition) {
    messages.push(createMessage('assistant', 'Voice input is not supported in this browser. You can still type short phrases like “safe place” or “road blocked.”'));
    saveHistory();
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
    listening = false;
    void addUserMessage(section, event.results?.[0]?.[0]?.transcript ?? '');
  };
  recognition.onerror = () => { listening = false; renderAssistant(section); };
  recognition.onend = () => { if (listening) { listening = false; renderAssistant(section); } };
  recognition.start();
}

function wireAssistant(section: HTMLElement) {
  section.querySelector<HTMLFormElement>('.ai-input-row')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = section.querySelector<HTMLInputElement>('[data-ai-input]');
    if (input) void addUserMessage(section, input.value);
  });
  section.querySelector<HTMLButtonElement>('[data-ai-mic]')?.addEventListener('click', () => startVoice(section));
  section.querySelectorAll<HTMLButtonElement>('[data-ai-delete]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.aiDelete) deleteMessage(section, button.dataset.aiDelete);
  }));
  section.querySelectorAll<HTMLButtonElement>('[data-navcat-action]').forEach((button) => button.addEventListener('click', () => {
    executeResultAction(button.dataset.navcatAction ?? '', button.dataset.navcatPhone);
  }));
  section.querySelectorAll<HTMLButtonElement>('[data-ai-quick]').forEach((button) => button.addEventListener('click', () => {
    const prompts: Record<string, string> = {
      risk: 'Am I safe right now?',
      route: 'Find me the safest route from my current location.',
      explain: 'Why did you choose this route?',
      weather: 'Is the rain dangerous right now?',
      responder: 'What is my responder status?',
      scared: "I'm scared.",
      stuck: "I'm stuck and can't evacuate.",
      medical: 'I need medical help.',
      guide: 'Guide me to safety.',
    };
    void addUserMessage(section, prompts[button.dataset.aiQuick ?? ''] ?? '');
  }));
}

function removeNavCatOverlay() {
  document.getElementById(NAVCAT_OVERLAY_ID)?.remove();
}

function getOrCreateNavCatOverlay(placeholder: HTMLElement) {
  let overlay = document.getElementById(NAVCAT_OVERLAY_ID) as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.id = NAVCAT_OVERLAY_ID;
    document.body.appendChild(overlay);
  }

  const rect = placeholder.getBoundingClientRect();
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${Math.max(0, rect.left)}px`,
    top: `${Math.max(0, rect.top)}px`,
    width: `${Math.max(320, rect.width)}px`,
    height: `${Math.max(320, window.innerHeight - Math.max(0, rect.top))}px`,
    zIndex: '30',
    overflow: 'auto',
    background: '#fbf7ef',
  });
  return overlay;
}

function maybeEnhanceAssistant() {
  const placeholder = document.querySelector<HTMLElement>('.figma-placeholder-panel');
  const onAssistant = placeholder?.querySelector('h2')?.textContent?.trim() === 'AI Assistant';

  if (onAssistant && placeholder) {
    const overlay = getOrCreateNavCatOverlay(placeholder);
    void refreshContext().finally(() => {
      if (document.body.contains(placeholder)) renderAssistant(overlay);
    });
    if (refreshTimer == null) refreshTimer = window.setInterval(() => void refreshContext(), 12_000);
    return;
  }

  removeNavCatOverlay();
  if (refreshTimer != null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

window.addEventListener('resize', () => maybeEnhanceAssistant());

window.addEventListener('jalrakshak:navcat-new-chat', () => {
  const section = document.getElementById(NAVCAT_OVERLAY_ID) as HTMLElement | null;
  if (!section) return;
  messages = [];
  crisisMode = false;
  responsePending = false;
  saveHistory();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  renderAssistant(section);
});

window.addEventListener('jalrakshak:navcat-load-session', (event) => {
  const section = document.getElementById(NAVCAT_OVERLAY_ID) as HTMLElement | null;
  if (!section) return;
  const detail = (event as CustomEvent<{ messages?: Message[] }>).detail;
  const incoming = Array.isArray(detail?.messages) ? detail.messages : [];
  messages = incoming
    .filter((message) => message && (message.role === 'assistant' || message.role === 'user') && typeof message.text === 'string')
    .map((message) => ({
      id: message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: message.role,
      text: message.text,
      actions: message.actions,
      createdAt: message.createdAt || Date.now(),
    }));
  crisisMode = false;
  responsePending = false;
  saveHistory();
  renderAssistant(section);
});

window.addEventListener('jalrakshak:route-analysis', (event) => {
  const next = (event as CustomEvent<EvacuationRoute>).detail;
  if (next) latestRoute = next;
});

const observer = new MutationObserver(() => maybeEnhanceAssistant());
observer.observe(document.body, { childList: true, subtree: true });
maybeEnhanceAssistant();