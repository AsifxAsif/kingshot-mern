import { useState } from 'react';

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className = '',
  badge = null,
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`collapsible-section inventory-collapsible ${open ? '' : 'collapsed'} ${className}`.trim()}>
      <div
        className="collapsible-header"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-expanded={open}
      >
        <span className="collapsible-title">
          {title}
          {badge != null ? <span className="collapsible-badge">{badge}</span> : null}
        </span>
        <span className="collapsible-chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </div>
      {open ? <div className="collapsible-body">{children}</div> : null}
    </div>
  );
}
