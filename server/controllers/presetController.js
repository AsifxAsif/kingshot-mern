import { sanitizePresetName, assertNoOperators } from '../utils/validate.js';
import { Preset } from '../models/index.js';

function userFilter(req) {
  if (req.user?.id) return { userId: req.user.id };
  return { userId: null };
}

export const listPresets = async (req, res) => {
  try {
    const filter = userFilter(req);
    let presets = await Preset.find(filter).select('name updatedAt').sort({ name: 1 }).lean();
    if (!req.user) {
      presets = presets.filter((p) => p.name === 'default');
    }
    if (!presets.length) {
      const created = await Preset.findOneAndUpdate(
        { ...filter, name: 'default' },
        { $setOnInsert: { name: 'default', userId: req.user?.id || null } },
        { upsert: true, new: true }
      ).select('name updatedAt').lean();
      presets = created ? [created] : [];
    }
    res.json(presets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPreset = async (req, res) => {
  try {
    const name = sanitizePresetName(req.params.name);
    if (!name) return res.status(400).json({ message: 'Invalid preset name' });
    if (!req.user && name !== 'default') {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const filter = { ...userFilter(req), name };
    let preset = await Preset.findOne(filter).lean();
    if (!preset && name === 'default') {
      preset = await Preset.create({ name: 'default', userId: req.user?.id || null });
      preset = preset.toObject();
    }
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
    if (!name) return res.status(400).json({ message: 'Invalid preset name' });
    if (name !== 'default' && !req.user) {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const userId = req.user?.id || null;
    const existing = await Preset.findOne({ userId, name });
    if (existing) return res.status(409).json({ message: 'Preset already exists' });

    const base =
      (await Preset.findOne({ userId, name: 'default' }).lean()) ||
      (await Preset.findOne({ userId: null, name: 'default' }).lean()) ||
      {};
    const { _id, name: _n, userId: _u, createdAt, updatedAt, ...rest } = base;

    const preset = await Preset.create({
      ...rest,
      name,
      userId,
      vault: rest.vault || {},
    });
    res.status(201).json(preset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePreset = async (req, res) => {
  try {
    assertNoOperators(req.body || {});
    const name = sanitizePresetName(req.params.name);
    if (!name) return res.status(400).json({ message: 'Invalid preset name' });
    if (!req.user && name !== 'default') {
      return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    const filter = { ...userFilter(req), name };
    const allowed = { ...req.body };
    delete allowed._id;
    delete allowed.name;
    delete allowed.userId;
    delete allowed.__v;
    delete allowed.createdAt;
    delete allowed.updatedAt;

    const preset = await Preset.findOneAndUpdate(
      filter,
      { $set: allowed },
      { new: true, upsert: name === 'default', setDefaultsOnInsert: true }
    );
    if (!preset) return res.status(404).json({ message: 'Preset not found' });
    if (!preset.userId && req.user?.id) {
      preset.userId = req.user.id;
      await preset.save();
    }
    res.json(preset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePreset = async (req, res) => {
  try {
    const name = sanitizePresetName(req.params.name);
    if (!name) return res.status(400).json({ message: 'Invalid preset name' });
    if (name === 'default') return res.status(400).json({ message: 'Cannot delete default' });
    if (!req.user) return res.status(401).json({ message: 'Login required', code: 'AUTH_REQUIRED' });
    const result = await Preset.findOneAndDelete({ userId: req.user.id, name });
    if (!result) return res.status(404).json({ message: 'Preset not found' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
