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
import { calcVaultScore } from '../utils/calc';
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
  const currentNameRef = useRef(currentName);
  currentNameRef.current = currentName;

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

  const refreshList = useCallback(async () => {
    if (!user) {
      setPresetList([{ name: 'default' }]);
      return [{ name: 'default' }];
    }
    try {
      const list = await listPresets();
      const cleaned = (list || []).filter((p) => p.name && p.name !== 'default');
      const withDefault = [{ name: 'default' }, ...cleaned];
      setPresetList(withDefault);
      return withDefault;
    } catch (err) {
      console.error('Failed to load presets:', err);
      setPresetList([{ name: 'default' }]);
      return [{ name: 'default' }];
    }
  }, [user]);

  // Handle user login - switch from default to first available preset
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      const list = await refreshList();
      const savedName = getSavedActiveName();

      // If current is default or saved preset doesn't exist, switch to first available
      const exists = list.some((p) => p.name === savedName);
      if (savedName === 'default' || !exists) {
        // Find first non-default preset
        const firstPreset = list.find((p) => p.name !== 'default');
        if (firstPreset) {
          try {
            const doc = await getPreset(firstPreset.name);
            if (!cancelled) {
              setCurrentName(firstPreset.name);
              setSavedActiveName(firstPreset.name);
              applyPresetDoc(doc);
            }
          } catch (e) {
            console.error('Failed to load preset after login:', e);
          }
        }
        // If no presets exist, keep default but mark that user is logged in
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await refreshList();

      // If user is logged in, never default to 'default' preset
      if (user) {
        const savedName = getSavedActiveName();
        // Check if saved preset exists
        const exists = list.some((p) => p.name === savedName);

        if (savedName === 'default' || !exists) {
          // Find first non-default preset
          const firstPreset = list.find((p) => p.name !== 'default');
          if (firstPreset && !cancelled) {
            try {
              const doc = await getPreset(firstPreset.name);
              setCurrentName(firstPreset.name);
              setSavedActiveName(firstPreset.name);
              applyPresetDoc(doc);
            } catch (e) {
              console.error('Failed to load first preset:', e);
              setCurrentName('default');
              setSavedActiveName('default');
              setState(loadLocalDefault());
            }
          } else if (!cancelled) {
            // No presets exist, but user is logged in - create default preset for them?
            // Actually, just use empty state with default name
            setCurrentName('default');
            setSavedActiveName('default');
            setState(loadLocalDefault());
          }
        } else if (!cancelled) {
          try {
            const doc = await getPreset(savedName);
            setCurrentName(savedName);
            setSavedActiveName(savedName);
            applyPresetDoc(doc);
          } catch {
            setCurrentName('default');
            setSavedActiveName('default');
            setState(loadLocalDefault());
          }
        }
      } else {
        // Guest user - use default preset from localStorage
        const wanted = getSavedActiveName();
        if (wanted === 'default') {
          setCurrentName('default');
          setSavedActiveName('default');
          setState(loadLocalDefault());
        } else if (list.some((p) => p.name === wanted)) {
          try {
            const doc = await getPreset(wanted);
            setCurrentName(wanted);
            setSavedActiveName(wanted);
            applyPresetDoc(doc);
          } catch {
            setCurrentName('default');
            setSavedActiveName('default');
            setState(loadLocalDefault());
          }
        } else {
          setCurrentName('default');
          setSavedActiveName('default');
          setState(loadLocalDefault());
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshList]);

  const scheduleSave = useCallback(
    (name, patch) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (name === 'default') {
          return;
        }
        if (!user) return;
        setSaving(true);
        try {
          await apiUpdate(name, {
            ...patch,
            username: user.username || '',
            gameId: user.gameId || '',
          });
        } catch (e) {
          console.error('Save failed', e);
        } finally {
          setSaving(false);
        }
      }, 400);
    },
    [user]
  );

  const updateSection = useCallback(
    (section, valueOrFn) => {
      setState((prev) => {
        const prevSec = prev[section] || {};
        const nextSec =
          typeof valueOrFn === 'function' ? valueOrFn(prevSec) : valueOrFn;
        const next = { ...prev, [section]: nextSec };
        if (currentNameRef.current === 'default') {
          saveLocalDefault(next);
        } else {
          scheduleSave(currentNameRef.current, { [section]: nextSec });
        }
        return next;
      });
    },
    [scheduleSave]
  );

  const setPageScore = useCallback(
    (key, score) => {
      setState((prev) => {
        const pageScores = { ...(prev.pageScores || {}), [key]: score };
        const next = { ...prev, pageScores };
        if (currentNameRef.current === 'default') {
          saveLocalDefault(next);
        } else {
          scheduleSave(currentNameRef.current, { pageScores });
        }
        return next;
      });
    },
    [scheduleSave]
  );

  const switchPreset = useCallback(
    async (name) => {
      setLoading(true);
      try {
        setSavedActiveName(name);
        setCurrentName(name);
        if (name === 'default') {
          setState(loadLocalDefault());
        } else {
          const doc = await getPreset(name);
          applyPresetDoc(doc);
        }
      } catch (e) {
        console.error(e);
        alert('Failed to load preset');
      } finally {
        setLoading(false);
      }
    },
    []
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
          settings: state.settings,
          pageScores: state.pageScores,
        };
        await apiCreate(body);
        await refreshList();
        setSavedActiveName(n);
        setCurrentName(n);
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
        await refreshList();
        if (currentNameRef.current === name) {
          const list = await refreshList();
          const firstPreset = list.find((p) => p.name !== 'default');
          if (firstPreset) {
            const doc = await getPreset(firstPreset.name);
            setSavedActiveName(firstPreset.name);
            setCurrentName(firstPreset.name);
            applyPresetDoc(doc);
          } else {
            setSavedActiveName('default');
            setCurrentName('default');
            setState(loadLocalDefault());
          }
        }
      } catch (e) {
        alert(e.message || 'Delete failed');
      }
    },
    [user, refreshList]
  );

  const resetCurrentPage = useCallback(() => {
    const path = window.location.pathname || '/';
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
      const scoreKey = PAGE_SCORE_RESET[path];
      if (scoreKey) {
        next.pageScores = { ...(prev.pageScores || {}), [scoreKey]: 0 };
      }
      if (currentNameRef.current === 'default') {
        saveLocalDefault(next);
      } else {
        const patch = {};
        for (const k of keys) patch[k] = next[k];
        if (scoreKey) patch.pageScores = next.pageScores;
        scheduleSave(currentNameRef.current, patch);
      }
      return next;
    });
  }, [scheduleSave]);

  const globalScore = useMemo(() => {
    const pages = Object.values(state.pageScores || {}).reduce(
      (s, n) => s + (Number(n) || 0),
      0
    );
    return pages;
  }, [state.pageScores]);

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