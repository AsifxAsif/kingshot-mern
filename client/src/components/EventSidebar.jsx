import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { EVENTS, EVENT_IDS, normalizeEventId } from '../utils/events';
import AssetImg from './AssetImg';
import { asset } from '../utils/images';

const COLLAPSED_KEY = 'kingshot_event_sidebar_collapsed';
const EDGE_KEY = 'kingshot_event_sidebar_edge';
const EDGE_Y_KEY = 'kingshot_event_sidebar_edge_y';

const EVENT_ICONS = {
  sg: 'sg_icon.webp',
  kvk: 'kvk_icon.webp',
  ab: 'ab_icon.webp',
};

const MOBILE_MQ = '(max-width: 768px)';
const HANDLE_H = 64;
/** Only after the finger moves this far do we treat it as a drag (not a tap). */
const DRAG_THRESHOLD = 12;

function readEdge() {
  try {
    return localStorage.getItem(EDGE_KEY) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}

function clampYFrac(yFrac, vh = typeof window !== 'undefined' ? window.innerHeight : 800) {
  const margin = HANDLE_H / 2 + 8;
  const min = margin / Math.max(vh, 1);
  const max = 1 - margin / Math.max(vh, 1);
  if (!Number.isFinite(yFrac)) return 0.5;
  return Math.min(max, Math.max(min, yFrac));
}

function readEdgeY() {
  try {
    const y = parseFloat(localStorage.getItem(EDGE_Y_KEY) || '0.5');
    return clampYFrac(Number.isFinite(y) ? y : 0.5);
  } catch {
    return 0.5;
  }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    mq.addListener?.(onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);
  return mobile;
}

export default function EventSidebar() {
  const { state, updateSection, switchEvent } = useApp();
  const active = normalizeEventId(state.settings?.activeEvent || 'sg') || 'sg';
  const isMobile = useIsMobile();
  const location = useLocation();
  const panelRef = useRef(null);
  const handleRef = useRef(null);

  /** Session refs for drag (no vertical “dead zones”) */
  const ptr = useRef({
    active: false,
    dragging: false,
    id: null,
    startX: 0,
    startY: 0,
    side: 'left',
    yFrac: 0.5,
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
  const [edgeY, setEdgeY] = useState(readEdgeY);

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

  const persistEdge = useCallback((side, yFrac) => {
    const y = clampYFrac(yFrac);
    setEdge(side);
    setEdgeY(y);
    try {
      localStorage.setItem(EDGE_KEY, side);
      localStorage.setItem(EDGE_Y_KEY, String(y));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onResize = () => setEdgeY((y) => clampYFrac(y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile) setCollapsedPersist(true);
  }, [location.pathname, isMobile, setCollapsedPersist]);

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
   * Drag vs tap:
   * - Movement below DRAG_THRESHOLD → tap → always open (any height).
   * - Movement above threshold → drag → update edge/Y only, do not open.
   * No vertical dead zones (30–70% or otherwise).
   */
  const onHandlePointerDown = (e) => {
    if (!isMobile) return;
    if (e.button != null && e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    ptr.current = {
      active: true,
      dragging: false,
      id: e.pointerId,
      startX,
      startY,
      side: edge,
      yFrac: edgeY,
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
      const dist = Math.hypot(dx, dy);

      if (!ptr.current.dragging) {
        if (dist < DRAG_THRESHOLD) return; // still a potential tap
        ptr.current.dragging = true;
      }

      const vh = window.innerHeight || 1;
      const vw = window.innerWidth || 1;
      // Follow finger vertically — full height range (clamped only to keep tab on-screen)
      const yFrac = clampYFrac(ev.clientY / vh, vh);

      let side = ptr.current.side;
      if (ev.clientX < vw * 0.4) side = 'left';
      else if (ev.clientX > vw * 0.6) side = 'right';

      ptr.current.side = side;
      ptr.current.yFrac = yFrac;
      setEdge(side);
      setEdgeY(yFrac);
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
      const yFrac = ptr.current.yFrac;
      ptr.current.active = false;
      ptr.current.dragging = false;
      ptr.current.id = null;

      if (wasDragging) {
        skipClick.current = true;
        persistEdge(side, yFrac);
      } else {
        skipClick.current = false;
        // Pure tap at ANY height → open
        setCollapsedPersist(false);
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleStyle = isMobile
    ? {
        top: `${edgeY * 100}%`,
        transform: 'translateY(-50%)',
        ...(edge === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
      }
    : undefined;

  return (
    <>
      {isMobile && collapsed && (
        <button
          ref={handleRef}
          type="button"
          className={`event-edge-handle edge-${edge}`}
          style={handleStyle}
          aria-label="Open events menu"
          title="Tap to open · Drag to move"
          onPointerDown={onHandlePointerDown}
          onClick={(e) => {
            // Backup: some mobile browsers suppress pointerup semantics near screen edges
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

      {!collapsed && (
        <div
          className="event-sidebar-backdrop"
          aria-hidden
          onClick={() => setCollapsedPersist(true)}
        />
      )}

      {(!isMobile || !collapsed) && (
        <aside
          ref={panelRef}
          className={`event-sidebar${collapsed ? ' is-collapsed' : ' is-expanded'}${
            isMobile ? (edge === 'right' ? ' edge-right' : ' edge-left') : ''
          }`}
          aria-label="Event switcher"
          style={
            isMobile
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
                  {collapsed && !isMobile ? (
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
              {isMobile && <> Tap the edge tab to open · drag it anywhere on the side.</>}
            </p>
          )}
        </aside>
      )}
    </>
  );
}
