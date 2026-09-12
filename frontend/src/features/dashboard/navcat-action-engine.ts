import { citizenSafetyApi, type EvacuationRoute, type SafetyContext } from './api/citizen-safety.api';

export type NavCatIntent =
  | 'greeting'
  | 'capabilities'
  | 'thanks'
  | 'find_safe_location'
  | 'route_explanation'
  | 'route_update'
  | 'current_location'
  | 'risk'
  | 'weather'
  | 'responder_status'
  | 'emergency_number'
  | 'need_rescue'
  | 'medical_help'
  | 'panic_support'
  | 'route_blocked'
  | 'after_event'
  | 'out_of_scope'
  | 'unclear';

export type NavCatAction =
  | { kind: 'open_map'; label: string }
  | { kind: 'emergency_help'; label: string }
  | { kind: 'call'; label: string; phone: string };

export type NavCatActionResult = {
  intent: NavCatIntent;
  text: string;
  actions?: NavCatAction[];
  crisis?: boolean;
  route?: EvacuationRoute | null;
};

type PositionSnapshot = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type NavCatContext = {
  userName: string;
  placeLabel: string;
  latestRoute: EvacuationRoute | null;
  latestSafety: SafetyContext | null;
  latestEmergencyStatus?: string | null;
  latestResponderName?: string | null;
};

const ROUTE_WORDS = /(safe|safety|shelter|evacuat|destination|route|directions|navigate|way out|where.*go)/i;
const BLOCKED_WORDS = /(road|way|route|path).*(block|closed|flood|water|tree|debris|can't pass|cannot pass)|block(ed|age)|can't go this way|cannot go this way/i;
const PANIC_WORDS = /(scared|panic|afraid|terrified|shaking|overwhelmed|help me|dont know what to do|don't know what to do)/i;

function compact(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function looksLikeGibberish(raw: string) {
  const value = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (value.length < 7) return false;
  const known = /(help|safe|route|road|risk|rain|weather|flood|water|river|location|where|map|responder|sos|medical|hurt|stuck|trapped|guide|shelter|blocked|emergency|police|ambulance|fire)/.test(value);
  if (known) return false;
  const vowels = (value.match(/[aeiou]/g) ?? []).length;
  return vowels / value.length < 0.2 || /(.)\1\1/.test(value);
}

function classifyIntent(input: string): NavCatIntent {
  const raw = compact(input);
  const text = raw.toLowerCase();

  if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.,?\s]*$/i.test(raw)) return 'greeting';
  if (/(what can you do|what do you do|who are you)/i.test(text)) return 'capabilities';
  if (/^(thanks|thank you|thx|ty)[!.,?\s]*$/i.test(raw)) return 'thanks';
  if (/(i'm safe now|i am safe now|we are safe|we're safe|it's over|it is over|rescued|after the flood)/i.test(text)) return 'after_event';
  if (/(emergency|helpline|hotline|phone number|call).*(number|police|ambulance|fire|emergency)|^(911|100)$/i.test(text)) return 'emergency_number';
  if (/(can't evacuate|cannot evacuate|need rescue|trapped|stuck|stranded)/i.test(text)) return 'need_rescue';
  if (/(medical|hurt|injured|bleeding|sick|ambulance)/i.test(text)) return 'medical_help';
  if (BLOCKED_WORDS.test(text)) return 'route_blocked';
  if (PANIC_WORDS.test(text)) return 'panic_support';
  if (/(where am i|my location|current location|locate me)/i.test(text)) return 'current_location';
  if (/(am i safe|my risk|risk right now|safe right now|flood risk)/i.test(text)) return 'risk';
  if (/(rain|raining|weather|forecast|dangerous rain)/i.test(text)) return 'weather';
  if (/(responder|sos|help.*way|response status|assigned responder)/i.test(text)) return 'responder_status';
  if (/(why.*route|explain.*route|why.*chosen|why this route)/i.test(text)) return 'route_explanation';
  if (/(route changed|reroute|route update|changed midway|change my plan|still safe)/i.test(text)) return 'route_update';
  if (ROUTE_WORDS.test(text) && /(find|take|guide|show|get|need|want|where|closest|nearest|best|safe)/i.test(text)) return 'find_safe_location';
  if (/(write.*code|programming|homework|essay|stock|crypto|movie|game|recipe|celebrity|politics|math problem|dating|sports score|joke)/i.test(text)) return 'out_of_scope';
  if (looksLikeGibberish(raw)) return 'unclear';
  return 'unclear';
}

function getPosition(): Promise<PositionSnapshot | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6500, maximumAge: 12_000 },
    );
  });
}

function distanceText(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(1, Math.round(meters))} m`;
}

function minutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function contactFor(latitude: number, longitude: number, text: string) {
  const isNepal = latitude >= 26 && latitude <= 31 && longitude >= 80 && longitude <= 89;
  const isUs = latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66;

  if (isUs) {
    return {
      phone: '911',
      label: 'Call 911',
      description: 'In the United States, 911 connects police, fire, and emergency medical services.',
    };
  }

  if (isNepal) {
    if (/(police|emergency|help|number|hotline|helpline)/i.test(text)) {
      return {
        phone: '100',
        label: 'Call Nepal Police 100',
        description: 'Nepal Police lists Police Control 100 as an emergency contact number.',
      };
    }
  }

  return null;
}

async function loadLiveContext(position: PositionSnapshot) {
  try {
    return await citizenSafetyApi.getContext(position.latitude, position.longitude);
  } catch {
    return null;
  }
}

async function calculateSafeRoute(position: PositionSnapshot) {
  try {
    return await citizenSafetyApi.getEvacuationRoute(position.latitude, position.longitude);
  } catch {
    return null;
  }
}

export async function runNavCatAction(input: string, context: NavCatContext): Promise<NavCatActionResult> {
  const intent = classifyIntent(input);
  const name = context.userName || 'there';

  if (intent === 'greeting') {
    return { intent, text: `Hello ${name}. How can I help you today?` };
  }
  if (intent === 'capabilities') {
    return { intent, text: 'I’m NavCat, JalRakshak’s safety assistant. I can check live flood context, find a safe destination, calculate and explain evacuation routes, check responder status, and connect you to emergency help.' };
  }
  if (intent === 'thanks') {
    return { intent, text: `You’re welcome, ${name}. I’m here if you need another safety check or route update.` };
  }
  if (intent === 'out_of_scope') {
    return { intent, text: 'Sorry, that’s outside my scope. I’m focused on flood safety, evacuation, live weather and risk context, routes, safe locations, and emergency response.' };
  }
  if (intent === 'unclear') {
    return { intent, text: `I didn’t understand that, ${name}. You can say something short like “safe place,” “road blocked,” “need rescue,” “weather,” or “emergency number.”` };
  }
  if (intent === 'after_event') {
    return { intent, text: `I’m glad you reached a safer point, ${name}. Stay somewhere safe, check whether anyone with you needs help, and keep an eye on official updates. I can still check weather, route conditions, or responder status.` };
  }
  if (intent === 'need_rescue') {
    return {
      intent,
      crisis: true,
      text: 'If moving would put you in more danger, stay where you are. I can open Emergency Help now so your location and current safety context can be attached to an SOS.',
      actions: [{ kind: 'emergency_help', label: 'Open Emergency Help' }],
    };
  }
  if (intent === 'medical_help') {
    return {
      intent,
      crisis: true,
      text: 'I can take you directly to Emergency Help for medical assistance and attach your current location.',
      actions: [{ kind: 'emergency_help', label: 'Request medical help' }],
    };
  }
  if (intent === 'panic_support') {
    const route = context.latestRoute;
    return {
      intent,
      crisis: true,
      text: route
        ? `I’m here with you, ${name}. You don’t need to figure everything out at once. Your current destination is ${route.destination_name}, about ${minutes(route.duration_s)} minutes away. I can keep the route visible for you.`
        : `I’m here with you, ${name}. You don’t need to explain everything perfectly. I can find a safe destination from your current location now.`,
      actions: route ? [{ kind: 'open_map', label: 'Open current route' }] : [{ kind: 'open_map', label: 'Find a safe route' }],
    };
  }

  const position = await getPosition();

  if (intent === 'emergency_number') {
    if (!position) {
      return { intent, text: 'I need your location to give the correct regional emergency number. Please allow location access, or tell me the country you are in.' };
    }
    const contact = contactFor(position.latitude, position.longitude, input);
    if (!contact) {
      return { intent, text: 'I do not have a verified emergency number for this region in the current directory. Use Emergency Help so JalRakshak can share your location with the responder workflow.', actions: [{ kind: 'emergency_help', label: 'Open Emergency Help' }] };
    }
    return { intent, text: contact.description, actions: [{ kind: 'call', label: contact.label, phone: contact.phone }] };
  }

  if (intent === 'current_location') {
    if (!position) return { intent, text: 'I could not access your location. Enable location permission and ask me again.' };
    return { intent, text: `I have your current GPS position with${position.accuracy ? ` about ±${Math.round(position.accuracy)} m` : ''} accuracy. I can use it immediately to calculate a safe route.`, actions: [{ kind: 'open_map', label: 'Show on Live Map' }] };
  }

  if (intent === 'find_safe_location' || intent === 'route_blocked') {
    if (!position) {
      return { intent, crisis: intent === 'route_blocked', text: 'I need your current location to calculate a safe route. Enable location permission and ask again.' };
    }

    const [route, safety] = await Promise.all([
      calculateSafeRoute(position),
      loadLiveContext(position),
    ]);

    if (!route) {
      return {
        intent,
        crisis: intent === 'route_blocked',
        text: 'I could not calculate a new route right now. I will not invent one. Open the Live Map to keep the last successful route visible and retry routing.',
        actions: [{ kind: 'open_map', label: 'Open Live Map' }],
      };
    }

    const screening = route.screening_status === 'complete'
      ? `${route.alternatives_considered} routes analyzed · ${route.rejected_count ?? 0} rejected · ${route.viable_count ?? 0} viable.`
      : `${route.alternatives_considered} route options considered.`;
    const risk = safety ? ` Current modeled flood risk is ${safety.prototype_risk_level.toUpperCase()} (${safety.prototype_risk_score}/100).` : '';
    const prefix = intent === 'route_blocked' ? 'I recalculated from your current position instead of keeping you on the blocked way. ' : '';

    return {
      intent,
      crisis: intent === 'route_blocked',
      route,
      text: `${prefix}Best current destination: ${route.destination_name}. ETA about ${minutes(route.duration_s)} min · ${distanceText(route.distance_m)}. ${screening}${risk}`,
      actions: [{ kind: 'open_map', label: intent === 'route_blocked' ? 'Open new route' : 'Open route' }],
    };
  }

  if (intent === 'risk' || intent === 'weather') {
    if (!position) return { intent, text: 'I need your location to check the live environmental context.' };
    const safety = await loadLiveContext(position);
    if (!safety) return { intent, text: 'Live environmental data is temporarily unavailable. I will not guess a risk level.' };
    if (intent === 'weather') {
      return { intent, text: `The current feed shows ${safety.precipitation_next_6h_mm.toFixed(1)} mm of rain over the next 6 hours${safety.precipitation_probability_max_6h == null ? '' : ` with up to ${safety.precipitation_probability_max_6h}% probability`}.` };
    }
    return { intent, text: `Your current JalRakshak model is ${safety.prototype_risk_level.toUpperCase()} at ${safety.prototype_risk_score}/100. Rain expected in the next 6 hours is ${safety.precipitation_next_6h_mm.toFixed(1)} mm. This is modeled context, not an official warning.` };
  }

  if (intent === 'route_explanation') {
    const route = context.latestRoute;
    if (!route) return { intent, text: 'There is no active route yet. Say “find me a safe place” and I can calculate one from your current location.' };
    return { intent, text: `JalRakshak considered ${route.alternatives_considered} route options. ${route.screening_status === 'complete' ? `${route.rejected_count ?? 0} were rejected and ${route.viable_count ?? 0} remained viable. ` : ''}The current recommendation goes to ${route.destination_name}.`, actions: [{ kind: 'open_map', label: 'View route analysis' }] };
  }

  if (intent === 'route_update') {
    if (!position) return { intent, text: 'I need your current location to verify whether the route should change.' };
    const route = await calculateSafeRoute(position);
    if (!route) return { intent, text: 'I could not verify a new route right now, so I will not tell you that the old route is safe. Keep the last successful route visible while routing retries.', actions: [{ kind: 'open_map', label: 'Open Live Map' }] };
    return { intent, route, text: `I checked again. The latest recommendation is ${route.destination_name}, about ${minutes(route.duration_s)} min · ${distanceText(route.distance_m)}.`, actions: [{ kind: 'open_map', label: 'Open latest route' }] };
  }

  if (intent === 'responder_status') {
    if (!context.latestEmergencyStatus) return { intent, text: 'I do not see an active SOS right now. I can open Emergency Help if you need a responder.', actions: [{ kind: 'emergency_help', label: 'Emergency Help' }] };
    return { intent, text: `Your latest SOS is ${context.latestEmergencyStatus.replace('_', ' ')}.${context.latestResponderName ? ` ${context.latestResponderName} is assigned.` : ''}` };
  }

  return { intent: 'unclear', text: 'I’m not sure what you need. You can say “safe place,” “road blocked,” “need rescue,” “weather,” or “emergency number.”' };
}
