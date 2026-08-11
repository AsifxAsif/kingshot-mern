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
  updatePreset as apiUpdate,
  deletePreset as apiDelete,
} from '../services/api';
import { buildRemainingVault } from '../utils/resources';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

const ACTIVE_KEY = 'kingshot_active_preset';
const DEFAULT_LOCAL_KEY = 'kingshot_default_state';

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
  widgets: {},
  misc: {},
  heroShards: {},
  heroWidgets: {},
  heroFlowers: {},
  lockedUpgrades: {},
  settings: {},
  pageScores: {},
};

const PAGE_SCORE_RESET = {
  '/': 'vault',
  '/buildings': 'buildings',
  '/troops': 'troops',
  '/war-academy': 'warAcademy',
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
      widgets: doc.widgets || {},
      misc: doc.misc || {},
      heroShards: doc.heroShards || {},
      heroWidgets: doc.heroWidgets || {},
      heroFlowers: doc.heroFlowers || {},
      lockedUpgrades: doc.lockedUpgrades || {},
      settings: doc.settings || {},
      pageScores: doc.pageScores || {},
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
      widgets: st.widgets || {},
      misc: st.misc || {},
      heroShards: st.heroShards || {},
      heroWidgets: st.heroWidgets || {},
      heroFlowers: st.heroFlowers || {},
      lockedUpgrades: st.lockedUpgrades || {},
      settings: st.settings || {},
      pageScores: st.pageScores || {},
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
      const cleaned = (list || []).filter((p) => p.name);
      // Always show default first
      const hasDefault = cleaned.some((p) => p.name === 'default');
      const withDefault = hasDefault
        ? cleaned
        : [{ name: 'default' }, ...cleaned];
      // sort default first
      withDefault.sort((a, b) => {
        if (a.name === 'default') return -1;
        if (b.name === 'default') return 1;
        return String(a.name).localeCompare(String(b.name));
      });
      setPresetList(withDefault);
      return withDefault;
    } catch (err) {
      console.error('Failed to load presets:', err);
      setPresetList([{ name: 'default' }]);
      return [{ name: 'default' }];
    }
  }, [user]);

  /**
   * Flush pending patches to Mongo when logged in.
   * Merges all section updates so rapid clicks don't drop fields.
   * Also always localStorage-mirrors so nothing is lost offline.
   */
  const flushSave = useCallback(async () => {
    const name = currentNameRef.current;
    const u = userRef.current;
    const st = stateRef.current;
    const patch = { ...pendingPatch.current };
    pendingPatch.current = {};

    // Always keep local backup
    try {
      localStorage.setItem(
        `${DEFAULT_LOCAL_KEY}:${name}`,
        JSON.stringify(st)
      );
      if (name === 'default') saveLocalDefault(st);
    } catch {
      /* ignore */
    }

    if (!u) return; // guest → local only

    setSaving(true);
    try {
      // Send full payload so every page field is always in Mongo
      const full = buildFullPayload(st, u);
      await apiUpdate(name, { ...full, ...patch });
    } catch (e) {
      console.error('Save failed', e);
      // put patch back so next flush retries
      pendingPatch.current = { ...patch, ...pendingPatch.current };
    } finally {
      setSaving(false);
    }
  }, [buildFullPayload]);

  const scheduleSave = useCallback(
    (name, patch) => {
      pendingPatch.current = { ...pendingPatch.current, ...(patch || {}) };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        flushSave();
      }, 300);
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

  // Initial load — prefer Mongo when logged in (including "default")
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await refreshList();
      const wanted = getSavedActiveName() || 'default';

      if (!cancelled) {
        if (!user) {
          setCurrentName('default');
          setSavedActiveName('default');
          setState(loadLocalDefault());
        } else {
          try {
            const doc = await getPreset(wanted);
            setCurrentName(wanted);
            setSavedActiveName(wanted);
            applyPresetDoc(doc);
          } catch {
            // First login: seed Mongo "default" from localStorage if any
            const local = loadLocalDefault();
            setCurrentName('default');
            setSavedActiveName('default');
            setState(local);
            try {
              await apiUpdate('default', buildFullPayload(local, user));
              await refreshList();
            } catch (e) {
              console.warn('Could not seed default preset', e);
            }
          }
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshList, buildFullPayload]);

  const updateSection = useCallback(
    (section, valueOrFn) => {
      setState((prev) => {
        const prevSec = prev[section] || {};
        const nextSec =
          typeof valueOrFn === 'function' ? valueOrFn(prevSec) : valueOrFn;
        const next = { ...prev, [section]: nextSec };
        stateRef.current = next;
        // local mirror immediately
        try {
          if (currentNameRef.current === 'default') saveLocalDefault(next);
          localStorage.setItem(
            `${DEFAULT_LOCAL_KEY}:${currentNameRef.current}`,
            JSON.stringify(next)
          );
        } catch {
          /* */
        }
        // Mongo when logged in (any preset including default)
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
        const prevScore = Number(prev.pageScores?.[key]) || 0;
        if (prevScore === n) return prev;
        const pageScores = { ...(prev.pageScores || {}), [key]: n };
        const next = { ...prev, pageScores };
        stateRef.current = next;
        if (currentNameRef.current === 'default') saveLocalDefault(next);
        scheduleSave(currentNameRef.current, { pageScores });
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
      if (!n || n === 'default') {
        alert('Choose a different preset name');
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
          widgets: state.widgets,
          misc: state.misc,
          heroShards: state.heroShards,
          heroWidgets: state.heroWidgets,
          heroFlowers: state.heroFlowers,
          lockedUpgrades: state.lockedUpgrades,
          settings: state.settings,
          pageScores: state.pageScores,
        };
        await apiCreate(body);
        await refreshList();
        setSavedActiveName(n);
        setCurrentName(n);
        // stay on same state (already copied)
      } catch (e) {
        alert(e.message || 'Create failed');
      }
    },
    [user, state, refreshList]
  );

  const deletePreset = useCallback(
    async (name) => {
      if (name === 'default') {
        if (!confirm('Clear local default preset data?')) return;
        saveLocalDefault({ ...EMPTY_STATE });
        if (currentNameRef.current === 'default') setState({ ...EMPTY_STATE });
        return;
      }
      if (!user) return;
      if (!confirm(`Delete preset "${name}"?`)) return;
      try {
        await apiDelete(name);
        const list = await refreshList();
        if (currentNameRef.current === name) {
          setSavedActiveName('default');
          setCurrentName('default');
          setState(loadLocalDefault());
        }
      } catch (e) {
        alert(e.message || 'Delete failed');
      }
    },
    [user, refreshList]
  );

  const resetCurrentPage = useCallback(() => {
    const path = window.location.pathname || '/';
    const scoreKey = PAGE_SCORE_RESET[path];
    let keys = [];
    if (path === '/' || path === '') keys = ['vault'];
    else if (path.includes('building')) keys = ['buildings'];
    else if (path.includes('troop')) keys = ['troops'];
    else if (path.includes('war')) keys = ['warAcademy'];
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
      if (currentNameRef.current === 'default') saveLocalDefault(next);
      const patch = {};
      for (const k of keys) patch[k] = next[k];
      if (scoreKey) patch.pageScores = next.pageScores;
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
      if (currentNameRef.current === 'default') saveLocalDefault(next);
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
    deletePreset,
    resetCurrent: resetCurrentPage,
    resetCurrentPage,
    updateSection,
    setPageScore,
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
