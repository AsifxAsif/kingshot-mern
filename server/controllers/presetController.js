import { sanitizePresetName, assertNoOperators } from '../utils/validate.js';
import { Preset } from '../models/index.js';

const PRESET_FIELDS = [
  'username',
  'gameId',
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
      .select('name username gameId updatedAt')
      .sort({ name: 1 })
      .lean();
    res.json(presets);
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
    const name = sanitizePresetName(req.body?.name);
    if (!name) {
      return res.status(400).json({ message: 'Invalid preset name' });
    }
    if (!req.user) {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const userId = req.user.id;
    const existing = await Preset.findOne({ userId, name });
    if (existing) return res.status(409).json({ message: 'Preset already exists' });

    const data = pickPresetBody(req.body);
    // Resolve identity from body or JWT user
    let username = data.username || req.body.username || req.user.username || '';
    let gameId = data.gameId || req.body.gameId || '';
    if (!username || !gameId) {
      try {
        const { User } = await import('../models/User.js');
        const u = await User.findById(userId).select('username gameId').lean();
        if (u) {
          if (!username) username = u.username || '';
          if (!gameId) gameId = u.gameId || '';
        }
      } catch {
        /* ignore */
      }
    }
    const preset = await Preset.create(
      orderedPresetDoc({ userId, name, username, gameId, data })
    );
    res.status(201).json(preset);
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
