import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

let idSeq = 0;

/**
 * Bottom-left notifications for important actions only.
 * toast.success / .error / .info(message, { durationMs? })
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message, opts = {}) => {
    const msg = String(message || '').trim();
    if (!msg) return;
    const id = ++idSeq;
    const durationMs = opts.durationMs ?? (type === 'error' ? 5000 : 3200);
    setItems((prev) => [...prev.slice(-4), { id, type, message: msg }]);
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs);
    }
  }, [dismiss]);

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
