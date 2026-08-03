export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  durationMs?: number;
}

const TOAST_EVENT = 'showtime:toast';

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function pushToast(type: ToastType, message: string, durationMs = 2800) {
  const toast: ToastMessage = {
    id: generateId(),
    type,
    message,
    durationMs
  };

  window.dispatchEvent(new CustomEvent<ToastMessage>(TOAST_EVENT, { detail: toast }));
}

export function onToast(listener: (toast: ToastMessage) => void) {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ToastMessage>;
    listener(customEvent.detail);
  };

  window.addEventListener(TOAST_EVENT, handler);

  return () => {
    window.removeEventListener(TOAST_EVENT, handler);
  };
}
