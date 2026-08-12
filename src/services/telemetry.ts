type TelemetryPayload = Record<string, unknown>;

interface TelemetryEvent {
  id: string;
  name: string;
  payload: TelemetryPayload;
  createdAt: string;
}

const TELEMETRY_STORAGE_KEY = 'epsync_telemetry_events';
const LEGACY_STORAGE_KEY = 'showtime_telemetry_events';
const MAX_EVENTS = 200;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function readEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: TelemetryEvent[]) {
  localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function trackEvent(name: string, payload: TelemetryPayload = {}) {
  try {
    const evt: TelemetryEvent = {
      id: generateId(),
      name,
      payload,
      createdAt: new Date().toISOString()
    };

    const events = readEvents();
    events.push(evt);
    writeEvents(events);

    if (import.meta.env.DEV) {
      console.debug('[telemetry]', evt.name, evt.payload);
    }
  } catch {
    // Do not break UX because of telemetry failures.
  }
}

export function getTelemetryEvents(): TelemetryEvent[] {
  return readEvents();
}
