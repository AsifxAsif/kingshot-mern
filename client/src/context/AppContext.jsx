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
import { useAuth } from './AuthContext';
import { parseResourceValue } from '../utils/calc';

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
    return localStorage.getItem(ACTIVE_KEY) || '';
  } catch {
    return '';
  }
}

function setSavedActiveName(name) {
  try {
    if (name) {
      localStorage.setItem(ACTIVE_KEY, name);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presetList, setPresetList] = useState([]);
  const [currentName, setCurrentName] = useState(() => getSavedActiveName() || '');
  const [state, setState] = useState(() => {
    const saved = getSavedActiveName();
    return saved ? loadLocalDefault() : { ...EMPTY_STATE };
  });
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
      const cleaned = (list || []).filter((p) => p.name);
      setPresetList(cleaned);
      return cleaned;
    } catch (err) {
      console.error('Failed to load presets:', err);
      setPresetList([]);
      return [];
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    let cancelled = false;
    (async () => {
      const list = await refreshList();
      const savedName = getSavedActiveName();
      
      const exists = list.some((p) => p.name === savedName);
      if (!exists || !savedName) {
        const firstPreset = list.length > 0 ? list[0] : null;
        if (firstPreset && !cancelled) {
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
        } else if (!cancelled) {
          setCurrentName('');
          setSavedActiveName('');
          setState({ ...EMPTY_STATE });
        }
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
      
      if (user) {
        const savedName = getSavedActiveName();
        const exists = list.some((p) => p.name === savedName);
        
        if (savedName && exists) {
          try {
            const doc = await getPreset(savedName);
            if (!cancelled) {
              setCurrentName(savedName);
              setSavedActiveName(savedName);
              applyPresetDoc(doc);
            }
          } catch (e) {
            console.error('Failed to load saved preset:', e);
            const firstPreset = list.length > 0 ? list[0] : null;
            if (firstPreset && !cancelled) {
              try {
                const doc = await getPreset(firstPreset.name);
                setCurrentName(firstPreset.name);
                setSavedActiveName(firstPreset.name);
                applyPresetDoc(doc);
              } catch (err) {
                setCurrentName('');
                setSavedActiveName('');
                setState({ ...EMPTY_STATE });
              }
            } else if (!cancelled) {
              setCurrentName('');
              setSavedActiveName('');
              setState({ ...EMPTY_STATE });
            }
          }
        } else if (list.length > 0 && !cancelled) {
          try {
            const doc = await getPreset(list[0].name);
            setCurrentName(list[0].name);
            setSavedActiveName(list[0].name);
            applyPresetDoc(doc);
          } catch (e) {
            setCurrentName('');
            setSavedActiveName('');
            setState({ ...EMPTY_STATE });
          }
        } else if (!cancelled) {
          setCurrentName('');
          setSavedActiveName('');
          setState({ ...EMPTY_STATE });
        }
      } else {
        const savedName = getSavedActiveName();
        if (savedName) {
          setCurrentName(savedName);
          setSavedActiveName(savedName);
          setState(loadLocalDefault());
        } else {
          setCurrentName('');
          setSavedActiveName('');
          setState({ ...EMPTY_STATE });
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
        if (!name) return;
        if (!user) {
          saveLocalDefault({ ...state, ...patch });
          return;
        }
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
    [user, state]
  );

  const updateSection = useCallback(
    (section, valueOrFn) => {
      setState((prev) => {
        const prevSec = prev[section] || {};
        const nextSec =
          typeof valueOrFn === 'function' ? valueOrFn(prevSec) : valueOrFn;
        const next = { ...prev, [section]: nextSec };
        if (!currentNameRef.current || currentNameRef.current === '') {
          saveLocalDefault(next);
        } else if (!user) {
          saveLocalDefault(next);
        } else {
          scheduleSave(currentNameRef.current, { [section]: nextSec });
        }
        return next;
      });
    },
    [scheduleSave, user]
  );

  const setPageScore = useCallback(
    (key, score) => {
      setState((prev) => {
        const pageScores = { ...(prev.pageScores || {}), [key]: score };
        const next = { ...prev, pageScores };
        if (!currentNameRef.current || currentNameRef.current === '') {
          saveLocalDefault(next);
        } else if (!user) {
          saveLocalDefault(next);
        } else {
          scheduleSave(currentNameRef.current, { pageScores });
        }
        return next;
      });
    },
    [scheduleSave, user]
  );

  const switchPreset = useCallback(
    async (name) => {
      setLoading(true);
      try {
        if (!name) {
          setCurrentName('');
          setSavedActiveName('');
          setState({ ...EMPTY_STATE });
          setLoading(false);
          return;
        }
        setSavedActiveName(name);
        setCurrentName(name);
        if (name === 'default' && !user) {
          setState(loadLocalDefault());
        } else if (name === 'default' && user) {
          try {
            const doc = await getPreset(name);
            applyPresetDoc(doc);
          } catch {
            setState({ ...EMPTY_STATE });
          }
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
    [user]
  );

  const createPreset = useCallback(
    async (name) => {
      if (!user) {
        alert('Login required to create a preset');
        return;
      }
      const n = String(name || '').trim();
      if (!n) {
        alert('Please enter a preset name');
        return;
      }
      try {
        const existing = presetList.find((p) => p.name === n);
        if (existing) {
          alert(`Preset "${n}" already exists`);
          return;
        }
        
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
    [user, state, refreshList, presetList]
  );

  const deletePreset = useCallback(
    async (name) => {
      if (!name) {
        alert('No preset selected to delete');
        return;
      }
      
      if (!user && name === 'default') {
        if (!confirm(`Delete preset "${name}" from local storage?`)) return;
        saveLocalDefault({ ...EMPTY_STATE });
        setState({ ...EMPTY_STATE });
        setCurrentName('');
        setSavedActiveName('');
        await refreshList();
        return;
      }
      
      if (!user) {
        alert('Login required to delete presets');
        return;
      }
      
      if (!confirm(`Delete preset "${name}"?`)) return;
      
      try {
        await apiDelete(name);
        const list = await refreshList();
        
        if (currentNameRef.current === name) {
          const firstPreset = list.length > 0 ? list[0] : null;
          if (firstPreset) {
            const doc = await getPreset(firstPreset.name);
            setSavedActiveName(firstPreset.name);
            setCurrentName(firstPreset.name);
            applyPresetDoc(doc);
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
      
      const currentName = currentNameRef.current;
      if (!currentName || currentName === '') {
        saveLocalDefault(next);
      } else if (!user) {
        saveLocalDefault(next);
      } else {
        const patch = {};
        for (const k of keys) patch[k] = next[k];
        if (scoreKey) patch.pageScores = next.pageScores;
        scheduleSave(currentName, patch);
      }
      return next;
    });
  }, [scheduleSave, user]);

  /**
   * Calculate remaining resources after deducting locked upgrades from all pages
   */
  const getRemainingVault = useCallback(() => {
    const vault = state.vault || {};
    const locked = state.lockedUpgrades || {};
    const remaining = { ...vault };
    
    // Sum all locked costs across all pages
    const lockedCosts = {};
    for (const [key, lockedData] of Object.entries(locked)) {
      if (lockedData && lockedData.costTotals) {
        for (const [resKey, amount] of Object.entries(lockedData.costTotals)) {
          if (!resKey.startsWith('_')) {
            lockedCosts[resKey] = (lockedCosts[resKey] || 0) + amount;
          }
        }
      }
    }
    
    // Subtract locked costs from vault
    for (const [key, amount] of Object.entries(lockedCosts)) {
      if (remaining[key] !== undefined) {
        const current = parseResourceValue(remaining[key]);
        remaining[key] = Math.max(0, current - amount);
      }
    }
    
    return remaining;
  }, [state.vault, state.lockedUpgrades]);

  const remainingVault = useMemo(() => getRemainingVault(), [getRemainingVault]);

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
    remainingVault,
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
    getRemainingVault,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}