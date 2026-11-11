import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { joinClasses } from '@/core/utils/join-classes';
import { ToastContext } from './toast-context';
import type { ToastInput, ToastMessage } from './toast.model';

const TOAST_DURATION_MS = 6000;

let fallbackSequence = 0;

function createToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  fallbackSequence += 1;
  return `toast-${Date.now()}-${fallbackSequence}`;
}

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = createToastId();
      const message: ToastMessage = { id, ...input };

      setToasts((current) => [...current, message]);

      const timer = setTimeout(() => {
        dismiss(id);
      }, TOAST_DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;

    return () => {
      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }

      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={joinClasses('toast', `toast--${toast.tone ?? 'info'}`)} key={toast.id}>
            <div className="toast__content">
              <p className="toast__title">{toast.title}</p>
              {toast.description ? <p className="toast__description">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label={`Tutup notifikasi ${toast.title}`}
              onClick={() => dismiss(toast.id)}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
