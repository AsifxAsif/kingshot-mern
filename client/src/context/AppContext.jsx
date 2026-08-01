import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  listPresets,
  getPreset,
  createPreset as apiCreate,
  updatePreset as apiUpdate,
  deletePreset as apiDelete,
  resetPreset as apiReset,
} from '../services/api';

const AppContext = createContext(null);

// Same page score keys as original app.js (score_buildings, score_troops, ...)
export const PAGE_SCORE_KEYS = {
  buildings: 'score_buildings',
  warAcademy: 'score_academy',
  widgets: 'score_widgets',
  heroes: 'score_heroes',
  heroGear: 'score_herogear',
  govGear: 'score_govgear',
  govCharm: 'score_govcharm',
  pets: 'score_pets',
  troops: 'score_troops',
  misc: 'score_misc',
};

// Which state keys belong to each route (page-only reset)
export const PAGE_STATE_KEYS = {
  '/': ['vault'],
  '/buildings': ['buildings'],
  '/war-academy': ['warAcademy'],
  '/widgets': ['widgets', 'heroWidgets'],
  '/heroes': ['heroes', 'heroShards', 'heroFlowers'],
  '/hero-gear': ['heroGear'],
  '/gov-gear': ['govGear'],
  '/gov-charm': ['govCharm'],
  '/pets': ['pets'],
  '/troops': ['troops'],
  '/misc': ['misc'],
  '/profile': [],
};

export const PAGE_SCORE_RESET = {
  '/': null,
  '/buildings': 'score_buildings',
  '/war-academy': 'score_academy',
  '/widgets': 'score_widgets',
  '/heroes': 'score_heroes',
  '/hero-gear': 'score_herogear',
  '/gov-gear': 'score_govgear',
  '/gov-charm': 'score_govcharm',
  '/pets': 'score_pets',
  '/troops': 'score_troops',
  '/misc': 'score_misc',
};


const emptyState = () => ({
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
  heroFlowers: {},
  heroWidgets: {},
  lockedUpgrades: {},
  settings: {},
  pageScores: {},
});

function sumPageScores(pageScores = {}) {
  let total = 0;
  for (const key of Object.values(PAGE_SCORE_KEYS)) {
    total += parseInt(pageScores[key] || 0, 10) || 0;
  }
  return total;
}

export function AppProvider({ children }) {
  const [presetList, setPresetList] = useState([]);
  const [currentName, setCurrentName] = useState('default');
  const [state, setState] = useState(emptyState());
  const [globalScore, setGlobalScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        let list = await listPresets();
        if (!list.length) {
          await apiCreate('default');
          list = await listPresets();
        }
        setPresetList(list);
        const name = list.find((p) => p.name === 'default')?.name || list[0].name;
        setCurrentName(name);
        const full = await getPreset(name);
        const merged = { ...emptyState(), ...full };
        setState(merged);
        setGlobalScore(sumPageScores(merged.pageScores));
      } catch (err) {
        console.error('Failed to load presets from MongoDB:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep global score in sync with pageScores
  useEffect(() => {
    setGlobalScore(sumPageScores(state.pageScores));
  }, [state.pageScores]);

  const scheduleSave = useCallback((name, patch) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await apiUpdate(name, patch);
      } catch (err) {
        console.error('Save to MongoDB failed:', err);
      } finally {
        setSaving(false);
      }
    }, 400);
  }, []);

  const updateSection = useCallback(
    (section, valueOrUpdater) => {
      setState((prev) => {
        const nextVal =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(prev[section] || {}) : valueOrUpdater;
        const next = { ...prev, [section]: nextVal };
        scheduleSave(currentName, { [section]: nextVal });
        return next;
      });
    },
    [currentName, scheduleSave]
  );

  /**
   * Save a page's active score (like original saveCurrentPageScore).
   * pageKey: 'troops' | 'buildings' | ...  OR full key 'score_troops'
   */
  const setPageScore = useCallback(
    (pageKey, score) => {
      const storageKey = PAGE_SCORE_KEYS[pageKey] || pageKey;
      const num = Math.round(Number(score) || 0);
      setState((prev) => {
        const prevNum = Math.round(Number(prev.pageScores?.[storageKey] || 0));
        if (prevNum === num) return prev;
        const pageScores = { ...(prev.pageScores || {}), [storageKey]: num };
        scheduleSave(currentName, { pageScores });
        return { ...prev, pageScores };
      });
    },
    [currentName, scheduleSave]
  );

  const switchPreset = useCallback(async (name) => {
    setLoading(true);
    try {
      const full = await getPreset(name);
      const merged = { ...emptyState(), ...full };
      setCurrentName(name);
      setState(merged);
      setGlobalScore(sumPageScores(merged.pageScores));
    } catch (err) {
      console.error(err);
      alert('Failed to load preset from database');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPreset = useCallback(
    async (name) => {
      if (!name?.trim()) return;
      try {
        await apiCreate(name.trim());
        const list = await listPresets();
        setPresetList(list);
        await switchPreset(name.trim());
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      }
    },
    [switchPreset]
  );

  const deletePreset = useCallback(
    async (name) => {
      if (name === 'default') {
        alert('Cannot delete default preset');
        return;
      }
      try {
        await apiDelete(name);
        const list = await listPresets();
        setPresetList(list);
        await switchPreset('default');
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      }
    },
    [switchPreset]
  );

  const resetCurrentPage = useCallback(
    async (pathname) => {
      const path = pathname || '/';
      const keys = PAGE_STATE_KEYS[path];
      if (!keys || keys.length === 0) {
        alert('Nothing to reset on this page.');
        return;
      }
      const label = path === '/' ? 'Vault' : path.replace('/', '').replace(/-/g, ' ');
      if (!confirm(`Reset only the "${label}" page selections? Other pages stay unchanged.`)) return;

      setState((prev) => {
        const next = { ...prev };
        for (const k of keys) {
          if (k === 'vault') next.vault = {};
          else if (k === 'heroShards') next.heroShards = {};
          else if (k === 'heroWidgets') next.heroWidgets = {};
          else if (k === 'heroFlowers') next.heroFlowers = {};
          else next[k] = {};
        }
        // Clear page-related buff settings
        if (path === '/buildings' && next.settings) {
          next.settings = { ...next.settings, buildingBuff: undefined, saul: undefined, pans: undefined, wolf: undefined, kingPos: undefined, groundWorks: undefined, doubleTime: undefined };
        }
        if (path === '/war-academy' && next.settings) {
          next.settings = { ...next.settings, researchBuff: undefined, researchKing: undefined, freshIdeas: undefined };
        }
        if (path === '/troops' && next.settings) {
          next.settings = { ...next.settings, trainingBuff: undefined, trainingKing: undefined };
        }
        if (path === '/misc' && next.settings) {
          next.settings = { ...next.settings, gatherBuff: undefined };
        }
        const scoreKey = PAGE_SCORE_RESET[path];
        if (scoreKey) {
          next.pageScores = { ...(prev.pageScores || {}), [scoreKey]: 0 };
        }
        // Persist only changed slices
        const patch = {};
        for (const k of keys) patch[k] = next[k];
        if (scoreKey) patch.pageScores = next.pageScores;
        scheduleSave(currentName, patch);
        return next;
      });
    },
    [currentName, scheduleSave]
  );

  // legacy name kept for any callers
  const resetCurrent = resetCurrentPage;

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
    resetCurrent, resetCurrentPage,
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
