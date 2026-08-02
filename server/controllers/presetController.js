import {
	sanitizePresetName,
	assertNoOperators
} from '../utils/validate.js';
import {
	Preset
} from '../models/index.js';
export const listPresets = async (req, res) => {
	try {
		if (!req.user?.id) {
			return res.json([]);
		}
		const presets = await Preset.find({
			userId: req.user.id
		}).select('name username gameId updatedAt').sort({
			name: 1
		}).lean();
		res.json(presets.filter((p) => p.name !== 'default'));
	} catch (error) {
		res.status(500).json({
			message: error.message
		});
	}
};
export const getPreset = async (req, res) => {
	try {
		const name = sanitizePresetName(req.params.name);
		if (!name || name === 'default') {
			return res.status(400).json({
				message: 'Invalid preset name'
			});
		}
		if (!req.user) {
			return res.status(401).json({
				message: 'Login required',
				code: 'AUTH_REQUIRED'
			});
		}
		const preset = await Preset.findOne({
			userId: req.user.id,
			name
		}).lean();
		if (!preset) return res.status(404).json({
			message: 'Preset not found'
		});
		res.json(preset);
	} catch (error) {
		res.status(500).json({
			message: error.message
		});
	}
};
export const createPreset = async (req, res) => {
	try {
		assertNoOperators(req.body || {});
		const name = sanitizePresetName(req.body?.name);
		if (!name || name === 'default') {
			return res.status(400).json({
				message: 'Invalid preset name'
			});
		}
		if (!req.user) {
			return res.status(401).json({
				message: 'Login required',
				code: 'AUTH_REQUIRED'
			});
		}
		const userId = req.user.id;
		const existing = await Preset.findOne({
			userId,
			name
		});
		if (existing) return res.status(409).json({
			message: 'Preset already exists'
		});
		const {
			_id,
			name: _n,
			userId: _u,
			createdAt,
			updatedAt,
			__v,
			...rest
		} = req.body || {};
		const preset = await Preset.create({
			...rest,
			name,
			userId,
			username: req.body.username || req.user.username || '',
			gameId: req.body.gameId || '',
			vault: req.body.vault || {},
		});
		res.status(201).json(preset);
	} catch (error) {
		res.status(500).json({
			message: error.message
		});
	}
};
export const updatePreset = async (req, res) => {
	try {
		assertNoOperators(req.body || {});
		const name = sanitizePresetName(req.params.name);
		if (!name || name === 'default') {
			return res.status(400).json({
				message: 'Invalid preset name'
			});
		}
		if (!req.user) {
			return res.status(401).json({
				message: 'Login required',
				code: 'AUTH_REQUIRED'
			});
		}
		const allowed = {
			...req.body
		};
		delete allowed._id;
		delete allowed.name;
		delete allowed.userId;
		delete allowed.__v;
		delete allowed.createdAt;
		delete allowed.updatedAt;
		if (req.body.username != null) allowed.username = String(req.body.username);
		if (req.body.gameId != null) allowed.gameId = String(req.body.gameId);
		const preset = await Preset.findOneAndUpdate({
			userId: req.user.id,
			name
		}, {
			$set: allowed
		}, {
			new: true
		});
		if (!preset) return res.status(404).json({
			message: 'Preset not found'
		});
		res.json(preset);
	} catch (error) {
		res.status(500).json({
			message: error.message
		});
	}
};
export const deletePreset = async (req, res) => {
	try {
		const name = sanitizePresetName(req.params.name);
		if (!name || name === 'default') {
			return res.status(400).json({
				message: 'Cannot delete default'
			});
		}
		if (!req.user) return res.status(401).json({
			message: 'Login required',
			code: 'AUTH_REQUIRED'
		});
		const result = await Preset.findOneAndDelete({
			userId: req.user.id,
			name
		});
		if (!result) return res.status(404).json({
			message: 'Preset not found'
		});
		res.json({
			ok: true
		});
	} catch (error) {
		res.status(500).json({
			message: error.message
		});
	}
};
