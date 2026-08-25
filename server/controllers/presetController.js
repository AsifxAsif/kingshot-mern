
import { sanitizePresetName, assertNoOperators } from '../utils/validate.js';
import { Preset, User } from '../models/index.js';

/** Sanitize game id for name suffix */
function sanitizeGameId(gameId) {
  return String(gameId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 32);
}

/**
 * Storage name always includes _gameId suffix (unless display already ends with it).
 * UI uses displayName without requiring the suffix.
 */
export function storageNameFromDisplay(displayName, gameId) {
  const g = sanitizeGameId(gameId);
  let d = sanitizePresetName(displayName);
  if (!d) return '';
  if (g) {
    const suffix = `_${g}`;
    if (d === g) return d; // edge: name is only gameId
    if (d.endsWith(suffix)) return d;
    // strip accidental duplicate suffixes then add once
    while (d.endsWith(suffix)) d = d.slice(0, -suffix.length);
    d = sanitizePresetName(d) || 'preset';
    return `${d}${suffix}`;
  }
  return d;
}

export function displayNameFromStorage(name, gameId, explicit) {
  if (explicit != null && String(explicit).trim()) return String(explicit).trim();
  const g = sanitizeGameId(gameId);
  const n = String(name || '');
  if (g && n.endsWith(`_${g}`)) {
    const base = n.slice(0, -(g.length + 1));
    return base || n;
  }
  return n;
}


const PRESET_FIELDS = [
  'username',
  'gameId',
  'displayName',
  'vault',
  'troops',
  'buildings',
  'heroes',
  'heroGear',
  'govGear',
  'govCharm',
  'pets',
  'warAcademy',
  'widgets',
  'misc',
  'planner',
  'heroShards',
  'heroWidgets',
  'heroFlowers',
  'lockedUpgrades',
  'settings',
  'pageScores',
];

/** Build a plain object with stable field order: identity → vault → rest */
function orderedPresetDoc({ userId, name, username, gameId, data }) {
  const d = data || {};
  return {
    userId,
    name,
    displayName: data?.displayName != null ? String(data.displayName) : '',
    username: username != null ? String(username) : '',
    gameId: gameId != null ? String(gameId) : '',
    vault: d.vault != null ? d.vault : {},
    troops: d.troops != null ? d.troops : {},
    buildings: d.buildings != null ? d.buildings : {},
    heroes: d.heroes != null ? d.heroes : {},
    heroGear: d.heroGear != null ? d.heroGear : {},
    govGear: d.govGear != null ? d.govGear : {},
    govCharm: d.govCharm != null ? d.govCharm : {},
    pets: d.pets != null ? d.pets : {},
    warAcademy: d.warAcademy != null ? d.warAcademy : {},
    widgets: d.widgets != null ? d.widgets : {},
    misc: d.misc != null ? d.misc : {},
    planner: d.planner != null ? d.planner : {},
    heroShards: d.heroShards != null ? d.heroShards : {},
    heroWidgets: d.heroWidgets != null ? d.heroWidgets : {},
    heroFlowers: d.heroFlowers != null ? d.heroFlowers : {},
    lockedUpgrades: d.lockedUpgrades != null ? d.lockedUpgrades : {},
    settings: d.settings != null ? d.settings : {},
    pageScores: d.pageScores != null ? d.pageScores : {},
  };
}

function pickPresetBody(body = {}) {
  const out = {};
  for (const key of PRESET_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

export const listPresets = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.json([]);
    }
    const presets = await Preset.find({ userId: req.user.id })
      .select('name displayName username gameId updatedAt')
      .sort({ name: 1 })
      .lean();
    res.json(
      presets.map((p) => ({
        ...p,
        displayName: displayNameFromStorage(p.name, p.gameId, p.displayName),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPreset = async (req, res) => {
  try {
    const name = sanitizePresetName(req.params.name);
    if (!name) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }
    if (!req.user) {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const preset = await Preset.findOne({ userId: req.user.id, name }).lean();
    if (!preset) return res.status(404).json({ message: 'Preset not found' });
    res.json(preset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createPreset = async (req, res) => {
  try {
    assertNoOperators(req.body || {});
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const userId = req.user.id;
    const data = pickPresetBody(req.body || {});

    let username = data.username || req.body.username || req.user.username || '';
    let gameId = data.gameId || req.body.gameId || '';
    if (!username || !gameId) {
      try {
        const u = await User.findById(userId).select('username gameId').lean();
        if (u) {
          if (!username) username = u.username || '';
          if (!gameId) gameId = u.gameId || '';
        }
      } catch (_) {
        /* ignore */
      }
    }

    // UI name (optional separate field) → storage name always includes gameId
    const rawLabel = req.body?.displayName || req.body?.name || '';
    const displayName = String(rawLabel).trim() || 'preset';
    const name = storageNameFromDisplay(displayName, gameId);
    if (!name) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }

    const existing = await Preset.findOne({ userId, name });
    if (existing) {
      return res.status(409).json({ message: 'Preset already exists' });
    }

    const preset = await Preset.create(
      orderedPresetDoc({
        userId,
        name,
        username,
        gameId,
        data: { ...data, displayName: displayNameFromStorage(name, gameId, displayName) },
      })
    );
    const obj = preset.toObject ? preset.toObject() : preset;
    obj.displayName = displayNameFromStorage(obj.name, obj.gameId, obj.displayName);
    res.status(201).json(obj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePreset = async (req, res) => {
  try {
    assertNoOperators(req.body || {});
    const name = sanitizePresetName(req.params.name);
    if (!name) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }
    if (!req.user) {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }

    const allowed = pickPresetBody(req.body);

    // Always keep username / gameId on the preset (prefer body, else User record)
    let username = allowed.username != null ? String(allowed.username) : req.user.username || '';
    let gameId = allowed.gameId != null ? String(allowed.gameId) : '';
    try {
      const { User } = await import('../models/User.js');
      const u = await User.findById(req.user.id).select('username gameId').lean();
      if (u) {
        if (!username) username = u.username || '';
        if (allowed.gameId == null || allowed.gameId === '') gameId = u.gameId || gameId;
      }
    } catch {
      /* ignore */
    }

    const existing = await Preset.findOne({ userId: req.user.id, name }).lean();
    const merged = {
      ...(existing || {}),
      ...allowed,
      username,
      gameId,
    };
    // Drop mongoose meta if present from lean+spread
    delete merged._id;
    delete merged.__v;
    delete merged.createdAt;
    delete merged.updatedAt;

    const ordered = orderedPresetDoc({
      userId: req.user.id,
      name,
      username,
      gameId,
      data: merged,
    });

    // Full document replace keeps field order: username & gameId before vault
    const toWrite = { ...ordered };
    if (existing?.createdAt) toWrite.createdAt = existing.createdAt;
    toWrite.updatedAt = new Date();

    const preset = await Preset.findOneAndReplace(
      { userId: req.user.id, name },
      toWrite,
      { upsert: true, new: true, runValidators: true }
    );
    if (!preset) return res.status(500).json({ message: 'Save failed' });
    res.json(preset);
  } catch (error) {
    console.error('updatePreset', error);
    res.status(500).json({ message: error.message });
  }
};

export const deletePreset = async (req, res) => {
  try {
    const name = sanitizePresetName(req.params.name);
    if (!name) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }
    if (!req.user) return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    const result = await Preset.findOneAndDelete({ userId: req.user.id, name });
    if (!result) return res.status(404).json({ message: 'Preset not found' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Rename preset UI label; storage name is recalculated with _gameId */
export const renamePreset = async (req, res) => {
  try {
    assertNoOperators(req.body || {});
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const oldName = sanitizePresetName(req.params.name);
    if (!oldName) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }
    const rawLabel = req.body?.displayName || req.body?.name;
    if (!rawLabel || !String(rawLabel).trim()) {
      return res.status(400).json({ message: 'displayName is required' });
    }

    const existing = await Preset.findOne({ userId: req.user.id, name: oldName });
    if (!existing) {
      return res.status(404).json({ message: 'Preset not found' });
    }

    let gameId = existing.gameId || '';
    let username = existing.username || '';
    if (!gameId || !username) {
      try {
        const u = await User.findById(req.user.id).select('username gameId').lean();
        if (u) {
          if (!gameId) gameId = u.gameId || '';
          if (!username) username = u.username || '';
        }
      } catch (_) {
        /* ignore */
      }
    }

    const displayName = String(rawLabel).trim();
    const newName = storageNameFromDisplay(displayName, gameId);
    if (!newName) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }

    if (newName !== oldName) {
      const clash = await Preset.findOne({ userId: req.user.id, name: newName }).lean();
      if (clash) {
        return res.status(409).json({ message: 'A preset with that name already exists' });
      }
    }

    existing.name = newName;
    existing.displayName = displayNameFromStorage(newName, gameId, displayName);
    existing.gameId = gameId;
    existing.username = username;
    await existing.save();

    const obj = existing.toObject();
    obj.displayName = displayNameFromStorage(obj.name, obj.gameId, obj.displayName);
    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
