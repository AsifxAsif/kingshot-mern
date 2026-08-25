import { useEffect, useRef, useState } from 'react';

/**
 * Floating modal for confirm / prompt / alert (replaces window.alert/confirm/prompt).
 */
export default function AppModal({
  open,
  title,
  message,
  mode = 'confirm',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  defaultValue = '',
  placeholder = '',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter' && mode !== 'prompt') {
        e.preventDefault();
        onConfirm?.(mode === 'prompt' ? value : true);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (mode === 'prompt') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, mode, value, onConfirm, onCancel]);

  if (!open) return null;

  const submit = (e) => {
    e?.preventDefault?.();
    if (mode === 'prompt') onConfirm?.(value);
    else onConfirm?.(true);
  };

  return (
    <div className="app-modal-overlay" role="presentation" onClick={() => onCancel?.()}>
      <div
        className={`app-modal item-card${danger ? ' app-modal-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="item-card-header app-modal-header">
          <span id="app-modal-title">{title}</span>
        </div>
        <div className="item-card-body app-modal-body">
          {message && (
            <p className="app-modal-message">
              {String(message)
                .split('\n')
                .map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
            </p>
          )}
          {mode === 'prompt' && (
            <form onSubmit={submit}>
              <input
                ref={inputRef}
                className="app-modal-input"
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
              />
            </form>
          )}
          <div className="app-modal-actions">
            {mode !== 'alert' && (
              <button type="button" className="preset-btn" onClick={() => onCancel?.()}>
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              className={`preset-btn${danger ? ' btn-delete' : ''}`}
              onClick={submit}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
