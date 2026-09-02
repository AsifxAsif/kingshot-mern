import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { EVENTS, EVENT_IDS, normalizeEventId } from '../utils/events';
import AssetImg from './AssetImg';
import { asset } from '../utils/images';

const COLLAPSED_KEY = 'kingshot_event_sidebar_collapsed';
const EDGE_KEY = 'kingshot_event_sidebar_edge';

const EVENT_ICONS = {
  sg: 'sg_icon.webp',
  kvk: 'kvk_icon.webp',
  ab: 'ab_icon.webp',
};

/** Edge-tab + floating panel for any viewport narrower than 1280px */
const COMPACT_MQ = '(max-width: 1279px)';
/** Only after the finger moves this far do we treat it as a drag (not a tap). */
const DRAG_THRESHOLD = 12;

function readEdge() {
  try {
    return localStorage.getItem(EDGE_KEY) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}

function useIsCompact() {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MQ).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MQ);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    mq.addListener?.(onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);
  return compact;
}

export default function EventSidebar() {
  const { state, updateSection, switchEvent } = useApp();
  const active = normalizeEventId(state.settings?.activeEvent || 'sg') || 'sg';
  const isCompact = useIsCompact();
  const location = useLocation();
  const panelRef = useRef(null);
  const handleRef = useRef(null);

  /** Horizontal-only drag (left / right edge). Vertical position is always center. */
  const ptr = useRef({
    active: false,
    dragging: false,
    id: null,
    startX: 0,
    startY: 0,
    side: 'left',
  });
  /** When true, the next click is ignored (it was a drag end). */
  const skipClick = useRef(false);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem(COLLAPSED_KEY);
      if (v === null) return true;
      return v === '1';
    } catch {
      return true;
    }
  });
  const [edge, setEdge] = useState(readEdge);

  const setEvent = (id) => {
    const nextId = normalizeEventId(id) || id;
    if (typeof switchEvent === 'function') {
      switchEvent(nextId);
    } else {
      updateSection('settings', (prev) => ({
        ...(prev || {}),
        activeEvent: nextId,
      }));
    }
  };

  const setCollapsedPersist = useCallback((next) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const persistEdge = useCallback((side) => {
    setEdge(side);
    try {
      localStorage.setItem(EDGE_KEY, side);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isCompact) setCollapsedPersist(true);
  }, [location.pathname, isCompact, setCollapsedPersist]);

  useEffect(() => {
    if (collapsed) return undefined;
    const onPointer = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (handleRef.current?.contains(e.target)) return;
        setCollapsedPersist(true);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setCollapsedPersist(true);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [collapsed, setCollapsedPersist]);

  /**
   * Compact view:
   * - Handle is fixed at vertical center (no up/down drag).
   * - Drag left/right to snap to that edge; tap opens the panel.
   */
  const onHandlePointerDown = (e) => {
    if (!isCompact) return;
    if (e.button != null && e.button !== 0) return;

    ptr.current = {
      active: true,
      dragging: false,
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      side: edge,
    };

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      if (!ptr.current.active || ptr.current.id !== ev.pointerId) return;
      const dx = ev.clientX - ptr.current.startX;
      const dy = ev.clientY - ptr.current.startY;
      // Ignore pure vertical movement for drag mode
      if (!ptr.current.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        // Only enter drag when horizontal movement dominates
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        ptr.current.dragging = true;
      }

      const vw = window.innerWidth || 1;
      let side = ptr.current.side;
      if (ev.clientX < vw * 0.4) side = 'left';
      else if (ev.clientX > vw * 0.6) side = 'right';
      else if (Math.abs(dx) > 40) side = dx > 0 ? 'right' : 'left';

      ptr.current.side = side;
      setEdge(side);
    };

    const onUp = (ev) => {
      if (ptr.current.id != null && ev.pointerId !== ptr.current.id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      try {
        handleRef.current?.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* ignore */
      }

      const wasDragging = ptr.current.dragging;
      const side = ptr.current.side;
      ptr.current.active = false;
      ptr.current.dragging = false;
      ptr.current.id = null;

      if (wasDragging) {
        skipClick.current = true;
        persistEdge(side);
      } else {
        skipClick.current = false;
        setCollapsedPersist(false);
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Always vertical center on compact layouts */
  const handleStyle = isCompact
    ? {
        top: '50%',
        transform: 'translateY(-50%)',
        ...(edge === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
      }
    : undefined;

  return (
    <>
      {isCompact && collapsed && (
        <button
          ref={handleRef}
          type="button"
          className={`event-edge-handle edge-${edge}`}
          style={handleStyle}
          aria-label="Open events menu"
          title="Tap to open · Drag left/right to switch side"
          onPointerDown={onHandlePointerDown}
          onClick={(e) => {
            if (skipClick.current) {
              skipClick.current = false;
              return;
            }
            e.preventDefault();
            setCollapsedPersist(false);
          }}
        >
          <span className="event-edge-handle-chevron" aria-hidden>
            {edge === 'right' ? '‹' : '›'}
          </span>
        </button>
      )}

      {!collapsed && isCompact && (
        <div
          className="event-sidebar-backdrop"
          aria-hidden
          onClick={() => setCollapsedPersist(true)}
        />
      )}

      {(!isCompact || !collapsed) && (
        <aside
          ref={panelRef}
          className={`event-sidebar${collapsed ? ' is-collapsed' : ' is-expanded'}${
            isCompact ? (edge === 'right' ? ' edge-right' : ' edge-left') : ''
          }`}
          aria-label="Event switcher"
          style={
            isCompact
              ? {
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bottom: 'auto',
                  ...(edge === 'right'
                    ? { right: 8, left: 'auto' }
                    : { left: 8, right: 'auto' }),
                }
              : undefined
          }
        >
          <div className="event-sidebar-drawer-head">
            {!collapsed && <span className="event-sidebar-title">Events</span>}
            <button
              type="button"
              className="event-sidebar-toggle"
              aria-label={collapsed ? 'Expand events sidebar' : 'Collapse events sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
              onClick={() => setCollapsedPersist(!collapsed)}
            >
              {collapsed ? (edge === 'right' ? '‹' : '›') : edge === 'right' ? '›' : '‹'}
            </button>
          </div>

          <nav className="event-sidebar-nav">
            {EVENT_IDS.map((id) => {
              const ev = EVENTS[id];
              const isOn = active === id;
              const iconFile = EVENT_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`event-side-btn${isOn ? ' is-selected' : ''}`}
                  style={
                    isOn
                      ? { borderColor: ev.accent, boxShadow: `0 0 0 1px ${ev.accent}` }
                      : undefined
                  }
                  onClick={() => setEvent(id)}
                  title={`${ev.name} — ${ev.description}`}
                  aria-current={isOn ? 'true' : undefined}
                >
                  {collapsed && !isCompact ? (
                    <AssetImg
                      src={asset(iconFile)}
                      alt={ev.short}
                      size={28}
                      className="event-side-icon"
                    />
                  ) : (
                    <>
                      <span className="event-side-icon-row">
                        <AssetImg
                          src={asset(iconFile)}
                          alt=""
                          size={22}
                          className="event-side-icon"
                        />
                        <span
                          className="event-side-short"
                          style={{ color: isOn ? ev.accent : undefined }}
                        >
                          {ev.short}
                        </span>
                      </span>
                      <span className="event-side-name">{ev.name}</span>
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {!collapsed && (
            <p className="event-sidebar-hint">
              Switch event for point values on every page. Common vault resources stay shared.
              {isCompact && <> Tap the edge tab to open · drag left/right to move side.</>}
            </p>
          )}
        </aside>
      )}
    </>
  );
}
