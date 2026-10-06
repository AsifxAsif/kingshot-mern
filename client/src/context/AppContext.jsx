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
  resetPreset as apiResetPreset,
  restorePresetBackup as apiRestoreBackup,
  listPresetBackups as apiListBackups,
} from '../services/api';
import { buildRemainingVault } from '../utils/resources';
import { normalizeEventId } from '../utils/events';
import { useToast } from './ToastContext';
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

const OFFLINE_PENDING_KEY = 'ks_offline_pending_v1';

function writeOfflinePending(name, data) {
  try {
    localStorage.setItem(
      OFFLINE_PENDING_KEY,
      JSON.stringify({ name, data, ts: Date.now() })
    );
  } catch {
    /* quota */
  }
}

function readOfflinePending() {
  try {
    const raw = localStorage.getItem(OFFLINE_PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearOfflinePending() {
  try {
    localStorage.removeItem(OFFLINE_PENDING_KEY);
  } catch {
    /* ignore */
  }
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

/** Match localStorage active name to a cloud preset (exact, displayName, or _gameId suffix). */
function resolveSavedPresetName(list, saved) {
  if (!saved || saved === 'default') return null;
  const rows = list || [];
  if (rows.some((p) => p.name === saved)) return saved;
  const byDisplay = rows.find(
    (p) => p.displayName && String(p.displayName) === String(saved)
  );
  if (byDisplay?.name) return byDisplay.name;
  // "foo" matches storage "foo_12345"
  const byPrefix = rows.find(
    (p) =>
      p.name &&
      (String(p.name).startsWith(String(saved) + '_') ||
        String(saved).startsWith(String(p.name) + '_'))
  );
  if (byPrefix?.name) return byPrefix.name;
  return null;
}


export function AppProvider({ children }) {
  const { user, authReady } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presetList, setPresetList] = useState([]);
  const [currentName, setCurrentName] = useState(() => getSavedActiveName());
  const [state, setState] = useState(() =>
    getSavedActiveName() === 'default' ? loadLocalDefault() : { ...EMPTY_STATE }
  );
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  /** Full-preset what-if: no saves until Apply */
  const [sandboxActive, setSandboxActive] = useState(false);
  const sandboxActiveRef = useRef(false);
  const sandboxBaselineRef = useRef(null);
  const saveTimer = useRef(null);
  const pendingPatch = useRef({});
  const stateRef = useRef(state);
  stateRef.current = state;
  sandboxActiveRef.current = sandboxActive;
  /** Blocks cloud saves until a preset document has been loaded (prevents wiping DB with empty state). */
  const hydratedRef = useRef(false);
  const currentNameRef = useRef(currentName);
  currentNameRef.current = currentName;
  const userRef = useRef(user);
  userRef.current = user;

  const applyPresetDoc = (doc) => {
    if (!doc) {
      setState({ ...EMPTY_STATE });
      hydratedRef.current = true;
      return;
    }
    hydratedRef.current = true;
    setSandboxActive(false);
    sandboxBaselineRef.current = null;
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
  /**
   * Resolve Mongo preset name for the logged-in user.
   * Never leave saves on "default" / empty — use Username_gameId primary.
   */
  const resolveCloudPresetName = useCallback((preferred) => {
    const u = userRef.current;
    if (!u) return null;
    const n = String(preferred || currentNameRef.current || '').trim();
    if (n && n !== 'default') return n;
    return primaryPresetName(u);
  }, []);

  const flushSave = useCallback(async () => {
    const u = userRef.current;
    const st = stateRef.current;
    const patch = { ...pendingPatch.current };
    pendingPatch.current = {};

    if (!u) {
      // Guests: mirror calculator state to localStorage only
      saveLocalDefault(st);
      return;
    }

    // Never push empty/boot state to Mongo before the real preset is loaded
    if (!hydratedRef.current) {
      pendingPatch.current = { ...patch, ...pendingPatch.current };
      return;
    }
    if (sandboxActiveRef.current) return;

    let name = resolveCloudPresetName(currentNameRef.current);
    if (!name) return;

    // Keep refs / UI in sync if we had to fall back to primary
    if (currentNameRef.current !== name) {
      currentNameRef.current = name;
      setCurrentName(name);
      setSavedActiveName(name);
    }

    // Offline: persist full snapshot locally; sync when back online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      writeOfflinePending(name, { ...st, ...patch });
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const full = buildFullPayload(st, u);
      // Full document every time so every input / level / checkbox is stored
      await apiUpdate(name, { ...full, ...patch });
      clearOfflinePending();
    } catch (e) {
      console.error('Save failed', e);
      // Create primary on first write if missing
      try {
        const primary = primaryPresetName(u);
        if (primary) {
          const body = {
            name: primary,
            displayName: String(u.username || 'user').replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 32) || 'preset',
            ...buildFullPayload(st, u),
            ...patch,
          };
          try {
            await apiCreate(body);
          } catch {
            await apiUpdate(primary, { ...buildFullPayload(st, u), ...patch });
          }
          currentNameRef.current = primary;
          setCurrentName(primary);
          setSavedActiveName(primary);
        }
      } catch (e2) {
        console.error('Create/save primary failed', e2);
        pendingPatch.current = { ...patch, ...pendingPatch.current };
      }
    } finally {
      setSaving(false);
    }
  }, [buildFullPayload, resolveCloudPresetName]);

  const scheduleSave = useCallback(
    (name, patch) => {
      if (sandboxActiveRef.current) return;
      const u = userRef.current;
      if (!u) {
        // Guest: still persist locally so inputs survive refresh
        pendingPatch.current = { ...pendingPatch.current, ...(patch || {}) };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveLocalDefault(stateRef.current);
        }, 150);
        return;
      }
      const cloudName = resolveCloudPresetName(name);
      if (!cloudName) return;
      pendingPatch.current = { ...pendingPatch.current, ...(patch || {}) };
      // Always keep a local offline mirror of the latest full state
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const merged = { ...stateRef.current, ...pendingPatch.current };
        writeOfflinePending(cloudName, merged);
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Short debounce; full snapshot still sent on flush
      saveTimer.current = setTimeout(() => {
        flushSave();
      }, 150);
    },
    [flushSave, resolveCloudPresetName]
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


  // Online / offline: queue locally offline, push to DB when back online
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      const pending = readOfflinePending();
      if (pending?.data && hydratedRef.current) {
        try {
          // Restore pending edits into state then flush
          if (pending.data && typeof pending.data === 'object') {
            setState((prev) => {
              const next = { ...prev, ...pending.data };
              stateRef.current = next;
              return next;
            });
          }
          await flushSave();
          clearOfflinePending();
          toast.success('Back online — changes synced to database');
        } catch (e) {
          console.error(e);
          toast.error('Back online but sync failed — will retry on next save');
        }
      } else {
        toast.info('Back online');
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      if (hydratedRef.current) {
        writeOfflinePending(currentNameRef.current, stateRef.current);
        toast.warning('You are offline — changes save on this device until you reconnect');
      }
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flushSave, toast]);

  // Wait for auth to finish before touching localStorage active preset.
  // Previously: user=null while /auth/me loads → setSavedActiveName('default') wiped the selection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authReady) {
        setLoading(true);
        return;
      }

      setLoading(true);
      if (!user) {
        // True guest (no token) — only then use local default
        if (!cancelled) {
          setCurrentName('default');
          // Do NOT force localStorage to 'default' if a cloud name was stored;
          // only guests without a token use the local default key.
          setState(loadLocalDefault());
          await refreshList();
          setLoading(false);
        }
        return;
      }

      try {
        // Do NOT auto-delete any cloud preset (including legacy "default").
        // Accidental deletes wiped real user data; recovery is Profile → backups only.
        hydratedRef.current = false;
        const list = await refreshList();
        const saved = getSavedActiveName();
        // Prefer last selected preset (localStorage); do not always fall back to primary
        let wanted = resolveSavedPresetName(list, saved) || list[0]?.name || null;

        if (wanted) {
          const doc = await getPreset(wanted);
          if (!cancelled) {
            currentNameRef.current = wanted;
            setCurrentName(wanted);
            setSavedActiveName(wanted);
            applyPresetDoc(doc);
          }
        } else if (!cancelled) {
          // No cloud presets yet — create primary Username_gameId and persist full state
          const primary = primaryPresetName(user);
          const local = loadLocalDefault();
          const uiLabel =
            String(user.username || 'user')
              .replace(/[^a-zA-Z0-9_\-.]/g, '_')
              .slice(0, 32) || 'preset';
          if (primary) {
            try {
              await apiCreate({
                name: primary,
                displayName: uiLabel,
                ...buildFullPayload(local, user),
              });
            } catch {
              try {
                await apiUpdate(primary, buildFullPayload(local, user));
              } catch {
                /* ignore */
              }
            }
            try {
              const doc = await getPreset(primary);
              setCurrentName(primary);
              setSavedActiveName(primary);
              applyPresetDoc(doc);
              await refreshList();
            } catch {
              setCurrentName(primary);
              setSavedActiveName(primary);
              setState({ ...EMPTY_STATE, ...local });
            }
          } else {
            setCurrentName('');
            setSavedActiveName('');
            setState({ ...EMPTY_STATE });
          }
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
  }, [user, authReady, refreshList, buildFullPayload]);

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
        toast.success('Preset created');
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
        queueMicrotask(() => toast.info('Event switched — updating points…'));
        return next;
      });
    },
    [scheduleSave, toast]
  );

  const switchPreset = useCallback(
    async (name) => {
      if (!name) return;
      // Flush CURRENT preset, then switch — never write into the target by mistake
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      await flushSave();
      pendingPatch.current = {};

      // Sync ref BEFORE any further saves so isolation is preserved
      currentNameRef.current = name;
      setSavedActiveName(name);
      setCurrentName(name);

      try {
        if (!user) {
          setState(loadLocalDefault());
        } else {
          try {
            const doc = await getPreset(name);
            applyPresetDoc(doc);
          } catch {
            setState({ ...EMPTY_STATE });
            await apiUpdate(name, buildFullPayload(EMPTY_STATE, user));
          }
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load preset');
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
        // Save the OLD preset first so its data is not lost / mixed
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        await flushSave();
        pendingPatch.current = {};

        // Snapshot current calculator state into the NEW preset document only
        const body = {
          name: n,
          displayName: n,
          username: user.username || '',
          gameId: user.gameId || '',
          ...buildFullPayload(stateRef.current, user),
        };
        const created = await apiCreate(body);
        const storageName = created?.name || n;

        // Point all future saves at the NEW preset (ref must update synchronously)
        currentNameRef.current = storageName;
        setSavedActiveName(storageName);
        setCurrentName(storageName);
        await refreshList();
        toast.success('Preset created');
      } catch (e) {
        toast.error(e.message || 'Create failed');
      }
    },
    [user, refreshList, flushSave, buildFullPayload, toast]
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
        toast.success('Preset renamed');
        await refreshList();
        if (updated?.name) {
          setSavedActiveName(updated.name);
          setCurrentName(updated.name);
        }
        return updated;
      } catch (e) {
        toast.error(e.message || 'Rename failed');
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
          const prev = loadLocalDefault();
          saveLocalDefault({ ...EMPTY_STATE });
          setState({ ...EMPTY_STATE });
          toast.undo('Local preset cleared', () => {
            saveLocalDefault(prev);
            setState(prev);
            toast.success('Undo complete');
          });
        }
        return;
      }
      try {
        const result = await apiDelete(name);
        const backupId = result?.backupId;
        const list = await refreshList();
        if (currentNameRef.current === name) {
          const next = list[0];
          if (next?.name) {
            currentNameRef.current = next.name;
            setSavedActiveName(next.name);
            setCurrentName(next.name);
            try {
              const doc = await getPreset(next.name);
              applyPresetDoc(doc);
            } catch {
              setState({ ...EMPTY_STATE });
            }
          } else {
            currentNameRef.current = '';
            setSavedActiveName('');
            setCurrentName('');
            setState({ ...EMPTY_STATE });
          }
        }
        toast.undo(
          'Preset deleted — backup saved for 30 days',
          async () => {
            if (!backupId) {
              toast.error('No backup id to restore');
              return;
            }
            try {
              await apiRestoreBackup(backupId);
              await refreshList();
              const doc = await getPreset(name).catch(() => null);
              if (doc) {
                currentNameRef.current = name;
                setSavedActiveName(name);
                setCurrentName(name);
                applyPresetDoc(doc);
              }
              toast.success('Preset restored');
            } catch (e) {
              toast.error(e.message || 'Undo failed');
            }
          }
        );
      } catch (e) {
        toast.error(e.message || 'Delete failed');
      }
    },
    [user, refreshList, toast]
  );

  /** Reset entire active preset (all pages) — server keeps a 30-day backup */
  const resetPresetFull = useCallback(async () => {
    const empty = { ...EMPTY_STATE };
    if (!user || !currentNameRef.current || currentNameRef.current === 'default') {
      const prev = { ...stateRef.current };
      setState(empty);
      stateRef.current = empty;
      saveLocalDefault(empty);
      toast.undo('Preset cleared', () => {
        setState(prev);
        stateRef.current = prev;
        saveLocalDefault(prev);
        toast.success('Undo complete');
      });
      return;
    }
    const presetName = currentNameRef.current;
    try {
      const result = await apiResetPreset(presetName);
      const backupId = result?.backupId;
      setState(empty);
      stateRef.current = empty;
      toast.undo(
        'Preset reset — backup saved for 30 days',
        async () => {
          if (!backupId) {
            toast.error('No backup id to restore');
            return;
          }
          try {
            await apiRestoreBackup(backupId);
            const doc = await getPreset(presetName);
            applyPresetDoc(doc);
            toast.success('Preset restored');
          } catch (e) {
            toast.error(e.message || 'Undo failed');
          }
        }
      );
    } catch (e) {
      console.error(e);
      setState(empty);
      stateRef.current = empty;
      throw e;
    }
  }, [user, toast]);

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
    // Confirmation is handled by Navbar AppModal — do not use window.confirm here

    const snapshot = {
      keys: [...keys],
      scoreKey,
      sections: {},
      pageScores: stateRef.current.pageScores,
      eventPageScores: stateRef.current.eventPageScores,
    };
    for (const k of keys) {
      snapshot.sections[k] =
        k === 'vault'
          ? { ...(stateRef.current.vault || {}) }
          : { ...(stateRef.current[k] || {}) };
    }

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

    toast.undo(`"${label}" page reset`, () => {
      setState((prev) => {
        const next = { ...prev };
        for (const k of snapshot.keys) {
          next[k] = snapshot.sections[k] || {};
        }
        if (snapshot.pageScores) next.pageScores = snapshot.pageScores;
        if (snapshot.eventPageScores) next.eventPageScores = snapshot.eventPageScores;
        stateRef.current = next;
        const patch = {};
        for (const k of snapshot.keys) patch[k] = next[k];
        if (snapshot.scoreKey) {
          patch.pageScores = next.pageScores;
          patch.eventPageScores = next.eventPageScores;
        }
        scheduleSave(currentNameRef.current, patch);
        return next;
      });
      toast.success('Page restore complete');
    });
  }, [scheduleSave, toast]);

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

  const enterSandbox = useCallback(() => {
    try {
      sandboxBaselineRef.current = JSON.parse(JSON.stringify(stateRef.current));
    } catch {
      sandboxBaselineRef.current = { ...stateRef.current };
    }
    setSandboxActive(true);
    toast.info('Sandbox on — nothing is saved until you Apply');
  }, [toast]);

  const discardSandbox = useCallback(() => {
    const base = sandboxBaselineRef.current;
    if (base) {
      let restored;
      try {
        restored = JSON.parse(JSON.stringify(base));
      } catch {
        restored = { ...base };
      }
      setState(restored);
      stateRef.current = restored;
    }
    sandboxBaselineRef.current = null;
    setSandboxActive(false);
    pendingPatch.current = {};
    toast.info('Sandbox discarded — preset restored');
  }, [toast]);

  const applySandbox = useCallback(() => {
    sandboxBaselineRef.current = null;
    setSandboxActive(false);
    pendingPatch.current = {};
    toast.success('Sandbox applied — saving to preset');
    queueMicrotask(() => {
      const st = stateRef.current;
      scheduleSave(currentNameRef.current, {
        vault: st.vault,
        buildings: st.buildings,
        troops: st.troops,
        heroes: st.heroes,
        heroGear: st.heroGear,
        govGear: st.govGear,
        govCharm: st.govCharm,
        pets: st.pets,
        warAcademy: st.warAcademy,
        masters: st.masters,
        widgets: st.widgets,
        misc: st.misc,
        planner: st.planner,
        heroShards: st.heroShards,
        heroWidgets: st.heroWidgets,
        heroFlowers: st.heroFlowers,
        lockedUpgrades: st.lockedUpgrades,
        settings: st.settings,
        pageScores: st.pageScores,
        eventPageScores: st.eventPageScores,
      });
    });
  }, [scheduleSave, toast]);

  const remainingVault = useMemo(
    () => buildRemainingVault(state.vault || {}, state.lockedUpgrades || {}, null),
    [state.vault, state.lockedUpgrades]
  );

  /** remaining vault excluding one page's own locks (use when that page recomputes affordability) */
  const remainingVaultExcluding = useCallback(
    (pageKey) => buildRemainingVault(state.vault || {}, state.lockedUpgrades || {}, pageKey),
    [state.vault, state.lockedUpgrades]
  );

  /** Download current preset as JSON (local backup — works on free Mongo). */
  const exportActivePreset = useCallback(() => {
    const st = stateRef.current;
    const name = currentNameRef.current || 'preset';
    const payload = {
      format: 'kingshot-preset',
      version: 1,
      exportedAt: new Date().toISOString(),
      name,
      displayName: name,
      data: buildFullPayload(st, userRef.current),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48) || 'preset';
    a.href = url;
    a.download = `kingshot-preset-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    try {
      localStorage.setItem('ks_last_preset_export_ts', String(Date.now()));
    } catch {
      /* ignore */
    }
    toast.success('Preset exported');
    return payload;
  }, [buildFullPayload, toast]);

  /**
   * Import preset JSON into the *current* active preset and save to DB.
   * Accepts either { format, data } wrapper or a raw state object.
   */
  const importPresetData = useCallback(
    async (raw) => {
      let doc = raw;
      if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
        doc = raw.data;
      }
      if (!doc || typeof doc !== 'object') {
        throw new Error('Invalid preset file');
      }
      // Must have at least one known section
      const keys = [
        'vault', 'buildings', 'troops', 'heroes', 'heroGear', 'govGear', 'govCharm',
        'pets', 'warAcademy', 'masters', 'widgets', 'misc', 'heroShards', 'heroWidgets',
        'heroFlowers', 'settings', 'pageScores', 'eventPageScores', 'lockedUpgrades',
      ];
      if (!keys.some((k) => doc[k] != null && typeof doc[k] === 'object')) {
        throw new Error('File is not a Kingshot preset export');
      }

      hydratedRef.current = true;
      applyPresetDoc(doc);
      stateRef.current = {
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
        settings: doc.settings || {},
        pageScores: doc.pageScores || {},
        eventPageScores: doc.eventPageScores || {},
      };

      const u = userRef.current;
      if (u) {
        const name = resolveCloudPresetName(currentNameRef.current);
        if (name) {
          await apiUpdate(name, buildFullPayload(stateRef.current, u));
        }
      } else {
        saveLocalDefault(stateRef.current);
      }
      toast.success('Preset imported and saved');
      return true;
    },
    [buildFullPayload, resolveCloudPresetName, toast]
  );


  // 15-day local JSON export reminder (free Atlas users need offline copies)
  useEffect(() => {
    if (!user) return undefined;
    const DAY = 24 * 60 * 60 * 1000;
    const INTERVAL = 15 * DAY;
    const check = () => {
      if (!hydratedRef.current) return;
      let last = 0;
      try {
        last = parseInt(localStorage.getItem('ks_last_preset_export_ts') || '0', 10) || 0;
      } catch {
        last = 0;
      }
      const age = Date.now() - last;
      if (last > 0 && age < INTERVAL) return;
      // First-time: wait until user has been active (hydrated) — remind once
      const snoozeKey = 'ks_export_remind_snooze';
      try {
        const snooze = parseInt(localStorage.getItem(snoozeKey) || '0', 10) || 0;
        if (Date.now() - snooze < DAY) return; // don't spam same day after dismiss
      } catch {
        /* ignore */
      }
      toast.undo(
        last <= 0
          ? 'Tip: Export your preset as JSON for a free offline backup'
          : 'It has been 15+ days since your last preset export',
        () => {
          try {
            exportActivePreset();
          } catch (e) {
            console.error(e);
          }
        },
        { durationMs: 20000, undoLabel: 'Export now' }
      );
      try {
        localStorage.setItem(snoozeKey, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    const t0 = setTimeout(check, 8000); // after UI settles
    const id = setInterval(check, 6 * 60 * 60 * 1000); // re-check every 6h while open
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, [user, toast, exportActivePreset]);

  // Reassure user every 5 minutes that data is saved (logged-in + hydrated only)
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => {
      if (!hydratedRef.current) return;
      if (document.visibilityState === 'hidden') return;
      toast.success('All changes saved', { durationMs: 2500 });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, toast]);

  /** Restore a 30-day backup into an active preset and open it */
  const restoreFromBackup = useCallback(
    async (backupId) => {
      if (!user) {
        alert('Login required');
        return null;
      }
      try {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        await flushSave();
        const result = await apiRestoreBackup(backupId);
        const name = result?.name || result?.preset?.name;
        if (!name) throw new Error('Restore did not return preset name');
        await refreshList();
        setSavedActiveName(name);
        setCurrentName(name);
        try {
          const doc = await getPreset(name);
          applyPresetDoc(doc);
        } catch {
          if (result?.preset) applyPresetDoc(result.preset);
        }
        toast.success('Preset restored from backup');
        return name;
      } catch (e) {
        console.error(e);
        alert(e.message || 'Restore failed');
        return null;
      }
    },
    [user, flushSave, refreshList, toast]
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
    restoreFromBackup,
    exportActivePreset,
    importPresetData,
    resetCurrent: resetCurrentPage,
    resetCurrentPage,
    updateSection,
    setPageScore,
    switchEvent,
    setPageLockedCosts,
    remainingVault,
    remainingVaultExcluding,
    vault: state.vault,
    sandboxActive,
    enterSandbox,
    discardSandbox,
    applySandbox,
    isOnline,
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
