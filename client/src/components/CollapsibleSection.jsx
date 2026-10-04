import { useState } from 'react';

/** Tablet / desktop: ≥769px (matches site CSS). Mobile stays collapsed by default. */
export const DESKTOP_MQ = '(min-width: 769px)';

/**
 * Initial open state for collapsible input cards.
 * - preferOpen true → always start open
 * - otherwise open on PC/tablet, collapsed on mobile only
 */
export function initialCollapsibleOpen(preferOpen = false) {
  if (preferOpen) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia(DESKTOP_MQ).matches;
  } catch {
    return false;
  }
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className = '',
  badge = null,
}) {
  const [open, setOpen] = useState(() => initialCollapsibleOpen(!!defaultOpen));
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
