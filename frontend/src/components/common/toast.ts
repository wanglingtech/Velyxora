export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;
const listeners: Set<ToastListener> = new Set();
let lastToastFingerprint = '';
let lastToastAt = 0;

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  show(title: string, message?: string, type: ToastType = 'info', duration: number = 4000) {
    const fingerprint = `${type}\u0000${title}\u0000${message || ''}`;
    const now = Date.now();
    if (fingerprint === lastToastFingerprint && now - lastToastAt < 750) return;
    lastToastFingerprint = fingerprint;
    lastToastAt = now;
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msg: ToastMessage = { id, type, title, message, duration };
    listeners.forEach(l => l(msg));
  },
  success(title: string, message?: string) {
    this.show(title, message, 'success');
  },
  error(title: string, message?: string) {
    this.show(title, message, 'error', 5000);
  },
  warning(title: string, message?: string) {
    this.show(title, message, 'warning', 4500);
  },
  info(title: string, message?: string) {
    this.show(title, message, 'info');
  }
};
