import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let idSeq = 0;

const ICONS = {
  success: '✓',
  error: '!',
  warning: '⚠',
  info: 'i',
};

/**
 * Bottom-right notifications for important actions.
 * toast.success / .error / .info / .warning(message, { durationMs? })
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, leaving: true } : x))
    );
    // Allow exit animation, then remove
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 220);
  }, []);

  const push = useCallback(
    (type, message, opts = {}) => {
      const msg = String(message || '').trim();
      if (!msg) return;
      const id = ++idSeq;
      const durationMs = opts.durationMs ?? (type === 'error' ? 5200 : 3400);
      setItems((prev) => [...prev.slice(-4), { id, type, message: msg, leaving: false }]);
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      warning: (m, o) => push('warning', m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
            role="status"
          >
            <span className="toast-icon" aria-hidden>
              {ICONS[t.type] || ICONS.info}
            </span>
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
      warning: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
