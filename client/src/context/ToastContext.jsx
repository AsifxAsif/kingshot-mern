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
 * toast.success / .error / .info / .warning(message, { durationMs?, action?: { label, onClick } })
 * toast.undo(message, onUndo, { durationMs = 30000 })
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
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 220);
  }, []);

  const push = useCallback(
    (type, message, opts = {}) => {
      const msg = String(message || '').trim();
      if (!msg) return null;
      const id = ++idSeq;
      const durationMs = opts.durationMs ?? (type === 'error' ? 5200 : opts.action ? 30000 : 3400);
      const action = opts.action || null;
      setItems((prev) => [
        ...prev.slice(-4),
        { id, type, message: msg, leaving: false, action },
      ]);
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }
      return id;
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
      /** 30s undo toast with Undo + close */
      undo: (message, onUndo, opts = {}) =>
        push('warning', message, {
          durationMs: opts.durationMs ?? 30000,
          action: {
            label: opts.undoLabel || 'Undo',
            onClick: () => {
              try {
                onUndo?.();
              } catch (e) {
                console.error(e);
              }
            },
          },
        }),
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
            className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}${t.action ? ' toast-with-action' : ''}`}
            role="status"
          >
            <span className="toast-icon" aria-hidden>
              {ICONS[t.type] || ICONS.info}
            </span>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action.onClick?.();
                  dismiss(t.id);
                }}
              >
                {t.action.label || 'Undo'}
              </button>
            )}
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
      undo: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
