import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  listPresets,
  getPreset,
  createPreset as apiCreate,
  renamePreset as apiRename,
  updatePreset as apiUpdate,
  deletePreset as apiDelete,
} from '../services/api';
import { buildRemainingVault } from '../utils/resources';
import { normalizeEventId } from '../utils/events';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

const ACTIVE_KEY = 'kingshot_active_preset';
const DEFAULT_LOCAL_KEY = 'kingshot_default_state';


/** Primary cloud preset name: Username_gameId */
export function primaryPresetName(user) {
  if (!user) return null;
  const u = String(user.username || 'user').replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 32);
  const g = String(user.gameId || '0').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 32);
  return `${u}_${g}`;
}

const EMPTY_STATE = {
  vault: {},
  troops: {},
  buildings: {},
  heroes: {},
  heroGear: {},
  govGear: {},
  govCharm: {},
  pets: {},
  warAcademy: {},
  masters: {},
  widgets: {},
  misc: {},
  planner: {},
  heroShards: {},
  heroWidgets: {},
  heroFlowers: {},
  lockedUpgrades: {},
  settings: { activeEvent: 'sg' },
  pageScores: {},
  eventPageScores: {},
};

const PAGE_SCORE_RESET = {
  '/': 'vault',
  '/buildings': 'buildings',
  '/troops': 'troops',
  '/war-academy': 'warAcademy',
  '/masters': 'masters',
  '/heroes': 'heroes',
  '/hero-gear': 'heroGear',
  '/gov-gear': 'govGear',
  '/gov-charm': 'govCharm',
  '/widgets': 'widgets',
  '/pets': 'pets',
  '/misc': 'misc',
};

function loadLocalDefault() {
  try {
    const raw = localStorage.getItem(DEFAULT_LOCAL_KEY);
    if (!raw) return { ...EMPTY_STATE };
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveLocalDefault(state) {
  try {
    localStorage.setItem(DEFAULT_LOCAL_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function getSavedActiveName() {
  try {
    return localStorage.getItem(ACTIVE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

function setSavedActiveName(name) {
  try {
    localStorage.setItem(ACTIVE_KEY, name);
  } catch {
    /* */
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presetList, setPresetList] = useState([]);
  const [currentName, setCurrentName] = useState(() => getSavedActiveName());
  const [state, setState] = useState(() =>
    getSavedActiveName() === 'default' ? loadLocalDefault() : { ...EMPTY_STATE }
  );
  const saveTimer = useRef(null);
  const pendingPatch = useRef({});
  const stateRef = useRef(state);
  stateRef.current = state;
  const currentNameRef = useRef(currentName);
  currentNameRef.current = currentName;
  const userRef = useRef(user);
  userRef.current = user;

  const applyPresetDoc = (doc) => {
    if (!doc) {
      setState({ ...EMPTY_STATE });
      return;
    }
    const eventPageScores = doc.eventPageScores || {};
    const settings = doc.settings || {};
    const active =
      (typeof normalizeEventId === 'function'
        ? normalizeEventId(settings.activeEvent || 'sg')
        : null) ||
      String(settings.activeEvent || 'sg').toLowerCase() ||
      'sg';
    const fromBucket = eventPageScores[active] || {};
    const fromDoc = doc.pageScores || {};
    // Prefer live pageScores; fill gaps from the active event's saved bucket
    const pageScores = { ...fromBucket, ...fromDoc };
    setState({
      ...EMPTY_STATE,
      vault: doc.vault || {},
      troops: doc.troops || {},
      buildings: doc.buildings || {},
      heroes: doc.heroes || {},
      heroGear: doc.heroGear || {},
      govGear: doc.govGear || {},
      govCharm: doc.govCharm || {},
      pets: doc.pets || {},
      warAcademy: doc.warAcademy || {},
      masters: doc.masters || {},
      widgets: doc.widgets || {},
      misc: doc.misc || {},
      planner: doc.planner || {},
      heroShards: doc.heroShards || {},
      heroWidgets: doc.heroWidgets || {},
      heroFlowers: doc.heroFlowers || {},
      lockedUpgrades: doc.lockedUpgrades || {},
      settings,
      pageScores,
      eventPageScores,
    });
  };

  /** Full snapshot of calculator state for MongoDB */
  const buildFullPayload = useCallback((s, u) => {
    const st = s || EMPTY_STATE;
    return {
      vault: st.vault || {},
      troops: st.troops || {},
      buildings: st.buildings || {},
      heroes: st.heroes || {},
      heroGear: st.heroGear || {},
      govGear: st.govGear || {},
      govCharm: st.govCharm || {},
      pets: st.pets || {},
      warAcademy: st.warAcademy || {},
      masters: st.masters || {},
      widgets: st.widgets || {},
      misc: st.misc || {},
      planner: st.planner || {},
      heroShards: st.heroShards || {},
      heroWidgets: st.heroWidgets || {},
      heroFlowers: st.heroFlowers || {},
      lockedUpgrades: st.lockedUpgrades || {},
      settings: st.settings || {},
      pageScores: st.pageScores || {},
      eventPageScores: st.eventPageScores || {},
      username: u?.username || '',
      gameId: u?.gameId || '',
    };
  }, []);

  const refreshList = useCallback(async () => {
    if (!user) {
      setPresetList([{ name: 'default' }]);
      return [{ name: 'default' }];
    }
    try {
      const list = await listPresets();
      const primary = primaryPresetName(user);
      // Never show legacy "default" for logged-in users
      let cleaned = (list || []).filter((p) => p.name && p.name !== 'default');
      cleaned.sort((a, b) => {
        if (primary && a.name === primary) return -1;
        if (primary && b.name === primary) return 1;
        return String(a.name).localeCompare(String(b.name));
      });
      setPresetList(cleaned);
      return cleaned;
    } catch (err) {
      console.error('Failed to load presets:', err);
      setPresetList([]);
      return [];
    }
  }, [user]);

  /**
   * Flush full calculator state to MongoDB when logged in.
   * Every section (vault, levels, actives, scores, missions, settings, locks, …)
   * is written on each save so nothing lives only in browser memory.
   * Guests cannot persist — RequireAuthGate requires login.
   */
  const flushSave = useCallback(async () => {
    const name = currentNameRef.current;
    const u = userRef.current;
    const st = stateRef.current;
    const patch = { ...pendingPatch.current };
    pendingPatch.current = {};

    if (!u) {
      // Not logged in: do not treat localStorage as a real preset store
      return;
    }
    if (!name || name === 'default') {
      // Logged-in users should always have a named Mongo preset
      return;
    }

    setSaving(true);
    try {
      const full = buildFullPayload(st, u);
      // Full document every time (server replaces preset document)
      await apiUpdate(name, { ...full, ...patch });
    } catch (e) {
      console.error('Save failed', e);
      pendingPatch.current = { ...patch, ...pendingPatch.current };
    } finally {
      setSaving(false);
    }
  }, [buildFullPayload]);

  const scheduleSave = useCallback(
    (name, patch) => {
      if (!userRef.current) return;
      if (!name || name === 'default') return;
      pendingPatch.current = { ...pendingPatch.current, ...(patch || {}) };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Short debounce; full snapshot still sent on flush
      saveTimer.current = setTimeout(() => {
        flushSave();
      }, 150);
    },
    [flushSave]
  );

  // Flush on tab hide / unload so last clicks are not lost
  useEffect(() => {
    const onHide = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      flushSave();
    };
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => {
      window.removeEventListener('beforeunload', onHide);
    };
  }, [flushSave]);

  // Guests → local default. Logged-in → load existing presets only (no auto-create on login).
  // Username_gameId is created only for newly registered users via createPrimaryForNewUser().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!user) {
        if (!cancelled) {
          setCurrentName('default');
          setSavedActiveName('default');
          setState(loadLocalDefault());
          await refreshList();
          setLoading(false);
        }
        return;
      }

      try {
        // Optional cleanup of legacy cloud "default"
        const list0 = await listPresets().catch(() => []);
        if ((list0 || []).some((p) => p.name === 'default')) {
          try { await apiDelete('default'); } catch { /* ignore */ }
        }

        const list = await refreshList();
        const saved = getSavedActiveName();
        let wanted =
          saved && saved !== 'default' && list.some((p) => p.name === saved)
            ? saved
            : list[0]?.name || null;

        if (wanted) {
          const doc = await getPreset(wanted);
          if (!cancelled) {
            setCurrentName(wanted);
            setSavedActiveName(wanted);
            applyPresetDoc(doc);
          }
        } else if (!cancelled) {
          // Existing user with no presets yet — empty state until they create one
          setCurrentName('');
          setSavedActiveName('');
          setState({ ...EMPTY_STATE });
        }
      } catch (e) {
        console.error('Preset load failed', e);
        if (!cancelled) {
          const list = await refreshList().catch(() => []);
          if (list[0]?.name) {
            try {
              const doc = await getPreset(list[0].name);
              setCurrentName(list[0].name);
              setSavedActiveName(list[0].name);
              applyPresetDoc(doc);
            } catch {
              setCurrentName('');
              setState({ ...EMPTY_STATE });
            }
          } else {
            setCurrentName('');
            setState({ ...EMPTY_STATE });
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshList]);

  /**
   * Only for NEW registrations: create Username_gameId preset once.
   * Do not call this on normal login.
   */
  const createPrimaryForNewUser = useCallback(
    async (userObj) => {
      const u = userObj || user;
      if (!u) return null;
      const primary = primaryPresetName(u);
      if (!primary) return null;
      const local = loadLocalDefault();
      // UI label = username only; DB storage name keeps _gameId via server
      const uiLabel =
        String(u.username || 'user')
          .replace(/[^a-zA-Z0-9_\-.]/g, '_')
          .slice(0, 32) || 'preset';
      const body = { name: primary, displayName: uiLabel, ...buildFullPayload(local, u) };
      try {
        await apiCreate(body);
      } catch {
        // already exists (re-register edge) — load it
        try {
          await apiUpdate(primary, buildFullPayload(local, u));
        } catch {
          /* */
        }
      }
      await refreshList();
      try {
        const doc = await getPreset(primary);
        setCurrentName(primary);
        setSavedActiveName(primary);
        applyPresetDoc(doc);
        return primary;
      } catch (e) {
        console.error('Could not open primary preset', e);
        return null;
      }
    },
    [user, refreshList, buildFullPayload]
  );

  const updateSection = useCallback(
    (section, valueOrFn) => {
      setState((prev) => {
        const prevSec = prev[section] || {};
        const nextSec =
          typeof valueOrFn === 'function' ? valueOrFn(prevSec) : valueOrFn;
        const next = { ...prev, [section]: nextSec };
        stateRef.current = next;
        // Persist entire preset to Mongo (full snapshot on flush)
        scheduleSave(currentNameRef.current, { [section]: nextSec });
        return next;
      });
    },
    [scheduleSave]
  );

  const setPageScore = useCallback(
    (key, score) => {
      const n = Number(score) || 0;
      setState((prev) => {
        const eventId =
          (typeof normalizeEventId === 'function'
            ? normalizeEventId(prev.settings?.activeEvent || 'sg')
            : null) ||
          String(prev.settings?.activeEvent || 'sg').toLowerCase() ||
          'sg';
        const scores = prev.pageScores || {};
        const hasKey = Object.prototype.hasOwnProperty.call(scores, key);
        const prevScore = Number(scores[key]) || 0;
        const bucket = (prev.eventPageScores || {})[eventId] || {};
        const bucketPrev = Number(bucket[key]) || 0;
        if (hasKey && prevScore === n && bucketPrev === n) return prev;
        const pageScores = { ...scores, [key]: n };
        const eventPageScores = {
          ...(prev.eventPageScores || {}),
          [eventId]: { ...bucket, [key]: n },
        };
        const next = { ...prev, pageScores, eventPageScores };
        stateRef.current = next;
        scheduleSave(currentNameRef.current, { pageScores, eventPageScores });
        return next;
      });
    },
    [scheduleSave]
  );

  /**
   * Switch active event.
   * Common upgrades stay SHARED. Page score totals are stored per event in
   * eventPageScores and restored on switch so you do not need to re-open every page.
   * Open pages still re-publish with current rates (keeps the active page accurate).
   */
  const switchEvent = useCallback(
    (nextEventId) => {
      const nextId = String(nextEventId || 'sg').toLowerCase();
      setState((prev) => {
        const prevId = String(prev.settings?.activeEvent || 'sg').toLowerCase();
        if (prevId === nextId) return prev;
        const parked = {
          ...(prev.eventPageScores || {}),
          [prevId]: { ...(prev.pageScores || {}) },
        };
        const restored = { ...(parked[nextId] || {}) };
        const next = {
          ...prev,
          settings: {
            ...(prev.settings || {}),
            activeEvent: nextId,
            scoreEpoch: (Number(prev.settings?.scoreEpoch) || 0) + 1,
          },
          eventPageScores: parked,
          pageScores: restored,
        };
        stateRef.current = next;
        scheduleSave(currentNameRef.current, {
          settings: next.settings,
          eventPageScores: next.eventPageScores,
          pageScores: next.pageScores,
        });
        return next;
      });
    },
    [scheduleSave]
  );

  const switchPreset = useCallback(
    async (name) => {
      // flush current before switch
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      await flushSave();

      setLoading(true);
      try {
        setSavedActiveName(name);
        setCurrentName(name);
        if (!user) {
          setState(loadLocalDefault());
        } else {
          try {
            const doc = await getPreset(name);
            applyPresetDoc(doc);
          } catch {
            // create empty in mongo via next save
            setState({ ...EMPTY_STATE });
            await apiUpdate(name, buildFullPayload(EMPTY_STATE, user));
          }
        }
      } catch (e) {
        console.error(e);
        alert('Failed to load preset');
      } finally {
        setLoading(false);
      }
    },
    [user, flushSave, buildFullPayload]
  );
  const createPreset = useCallback(
    async (name) => {
      if (!user) {
        alert('Login required to create a preset');
        return;
      }
      const n = String(name || '').trim();
      if (!n || n.toLowerCase() === 'default') {
        alert('Choose a different preset name (default is not allowed when logged in)');
        return;
      }
      try {
        // Snapshot current calculator state into the new preset
        const body = {
          name: n,
          username: user.username || '',
          gameId: user.gameId || '',
          vault: state.vault,
          troops: state.troops,
          buildings: state.buildings,
          heroes: state.heroes,
          heroGear: state.heroGear,
          govGear: state.govGear,
          govCharm: state.govCharm,
          pets: state.pets,
          warAcademy: state.warAcademy,
          masters: state.masters,
          widgets: state.widgets,
          misc: state.misc,
          planner: state.planner,
          heroShards: state.heroShards,
          heroWidgets: state.heroWidgets,
          heroFlowers: state.heroFlowers,
          lockedUpgrades: state.lockedUpgrades,
          settings: state.settings,
          pageScores: state.pageScores,
          eventPageScores: state.eventPageScores,
        };
        const created = await apiCreate(body);
        const storageName = created?.name || n;
        await refreshList();
        setSavedActiveName(storageName);
        setCurrentName(storageName);
        // stay on same state (already copied)
      } catch (e) {
        alert(e.message || 'Create failed');
      }
    },
    [user, state, refreshList]
  );

  const renamePreset = useCallback(
    async (storageName, newDisplayName) => {
      if (!user) {
        alert('Login required to rename a preset');
        return null;
      }
      const label = String(newDisplayName || '').trim();
      if (!label) {
        alert('Enter a preset name');
        return null;
      }
      try {
        const updated = await apiRename(storageName, label);
        await refreshList();
        if (updated?.name) {
          setSavedActiveName(updated.name);
          setCurrentName(updated.name);
        }
        return updated;
      } catch (e) {
        alert(e.message || 'Rename failed');
        return null;
      }
    },
    [user, refreshList]
  );

  const deletePreset = useCallback(
    async (name) => {
      if (!name) return;
      // Guest local default
      if (!user) {
        if (name === 'default') {
          saveLocalDefault({ ...EMPTY_STATE });
          setState({ ...EMPTY_STATE });
        }
        return;
      }
      const primary = primaryPresetName(user);
      try {
        await apiDelete(name);
        const list = await refreshList();
        if (currentNameRef.current === name) {
          const next = list[0];
          if (next?.name) {
            setSavedActiveName(next.name);
            setCurrentName(next.name);
            try {
              const doc = await getPreset(next.name);
              applyPresetDoc(doc);
            } catch {
              setState({ ...EMPTY_STATE });
            }
          } else {
            setSavedActiveName('');
            setCurrentName('');
            setState({ ...EMPTY_STATE });
          }
        }
      } catch (e) {
        alert(e.message || 'Delete failed');
      }
    },
    [user, refreshList, buildFullPayload]
  );

  /** Reset entire active preset (all pages) */
  const resetPresetFull = useCallback(async () => {
    const empty = { ...EMPTY_STATE };
    setState(empty);
    stateRef.current = empty;
    if (!user || currentNameRef.current === 'default') {
      saveLocalDefault(empty);
      return;
    }
    try {
      await apiUpdate(currentNameRef.current, buildFullPayload(empty, user));
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, [user, buildFullPayload]);

  const resetCurrentPage = useCallback(() => {
    const path = window.location.pathname || '/';
    const scoreKey = PAGE_SCORE_RESET[path];
    let keys = [];
    if (path === '/' || path === '') keys = ['vault'];
    else if (path.includes('building')) keys = ['buildings'];
    else if (path.includes('troop')) keys = ['troops'];
    else if (path.includes('war')) keys = ['warAcademy'];
    else if (path.includes('master')) keys = ['masters'];
    else if (path.includes('hero-gear')) keys = ['heroGear'];
    else if (path.includes('hero')) keys = ['heroes', 'heroShards', 'heroFlowers'];
    else if (path.includes('gov-gear')) keys = ['govGear'];
    else if (path.includes('gov-charm')) keys = ['govCharm'];
    else if (path.includes('widget')) keys = ['widgets', 'heroWidgets'];
    else if (path.includes('pet')) keys = ['pets'];
    else if (path.includes('misc')) keys = ['misc'];
    else keys = [];

    const label = path === '/' ? 'Vault' : path.replace('/', '').replace(/-/g, ' ');
    if (!confirm(`Reset only the "${label}" page?`)) return;

    setState((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        if (k === 'vault') next.vault = {};
        else next[k] = {};
      }
      if (scoreKey) {
        next.pageScores = { ...(prev.pageScores || {}), [scoreKey]: 0 };
      }
      stateRef.current = next;
      const patch = {};
      for (const k of keys) patch[k] = next[k];
      if (scoreKey) patch.pageScores = next.pageScores;
      // Also persist per-event scores
      const eventId = String(next.settings?.activeEvent || 'sg').toLowerCase();
      if (scoreKey) {
        next.eventPageScores = {
          ...(prev.eventPageScores || {}),
          [eventId]: {
            ...((prev.eventPageScores || {})[eventId] || {}),
            [scoreKey]: 0,
          },
        };
        patch.eventPageScores = next.eventPageScores;
      }
      scheduleSave(currentNameRef.current, patch);
      return next;
    });
  }, [scheduleSave]);

  // Strongest Governor = sum of page scores only (matches old site)
  const globalScore = useMemo(() => {
    return Object.values(state.pageScores || {}).reduce(
      (s, n) => s + (Number(n) || 0),
      0
    );
  }, [state.pageScores]);

  /**
   * Register locked resource costs for a page so other pages see reduced vault.
   * costs: flat { resourceId: amount } for all Active upgrades on that page.
   * Skips setState when unchanged to avoid infinite re-render loops.
   */
  const setPageLockedCosts = useCallback((pageKey, costs) => {
    const clean = {};
    for (const [k, v] of Object.entries(costs || {})) {
      const n = Number(v) || 0;
      if (n > 0) clean[k] = n;
    }
    setState((prev) => {
      const prevPage = prev.lockedUpgrades?.[pageKey] || {};
      const prevKeys = Object.keys(prevPage);
      const nextKeys = Object.keys(clean);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((k) => Number(prevPage[k]) === Number(clean[k]))
      ) {
        return prev;
      }
      const lockedUpgrades = { ...(prev.lockedUpgrades || {}) };
      if (nextKeys.length === 0) delete lockedUpgrades[pageKey];
      else lockedUpgrades[pageKey] = clean;
      const next = { ...prev, lockedUpgrades };
      stateRef.current = next;
      scheduleSave(currentNameRef.current, { lockedUpgrades });
      return next;
    });
  }, [scheduleSave]);

  /** Vault after other pages' Active costs are reserved (exclude current page when checking itself) */
  const remainingVault = useMemo(
    () => buildRemainingVault(state.vault || {}, state.lockedUpgrades || {}, null),
    [state.vault, state.lockedUpgrades]
  );

  /** remaining vault excluding one page's own locks (use when that page recomputes affordability) */
  const remainingVaultExcluding = useCallback(
    (pageKey) => buildRemainingVault(state.vault || {}, state.lockedUpgrades || {}, pageKey),
    [state.vault, state.lockedUpgrades]
  );

  const value = {
    loading,
    saving,
    presetList,
    currentName,
    state,
    globalScore,
    switchPreset,
    createPreset,
        renamePreset,
    createPrimaryForNewUser,
    deletePreset,
    resetPresetFull,
    resetCurrent: resetCurrentPage,
    resetCurrentPage,
    updateSection,
    setPageScore,
    switchEvent,
    setPageLockedCosts,
    remainingVault,
    remainingVaultExcluding,
    vault: state.vault,
    setVault: (v) => updateSection('vault', v),
    updateVaultField: (id, val) =>
      updateSection('vault', (prev) => ({ ...prev, [id]: val })),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
