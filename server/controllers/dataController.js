import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { modelMap } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const ALLOWED_COLLECTIONS = new Set([
	'heroes',
	'hero_gears',
	'gov_gears',
	'gov_charms',
	'buildings',
	'troops',
	'war_academy',
	'pets',
	'misc',
	'widgets',
	'points',
	'forgehammers',
	'masters',
]);
const keyToFile = {
	heroes: 'Hero.json',
	hero_gears: 'Hero_Gear.json',
	gov_gears: 'Gov_Gear.json',
	gov_charms: 'Gov_Charm.json',
	buildings: 'Buildings.json',
	troops: 'Troops.json',
	war_academy: 'War_Academy.json',
	pets: 'Pet.json',
	misc: 'Misc.json',
	widgets: 'Widgets.json',
	points: 'Points.json',
	forgehammers: 'Forgehammer.json',
	masters: 'Masters.json',
};

/** Process-level cache — game catalogs rarely change at runtime */
const memCache = new Map();

function readLocalJson(collection) {
	const file = keyToFile[collection];
	if (!file) return null;
	const filePath = path.join(dataDir, file);
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
	} catch {
		return null;
	}
}

function resolveCollection(req) {
	if (req.params?.collection) return String(req.params.collection);
	if (req.params?.type) return String(req.params.type);
	const raw = (req.originalUrl || req.url || '').split('?')[0];
	const parts = raw.split('/').filter(Boolean);
	const idx = parts.findIndex((p) => p === 'data');
	if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
	if (parts.length) return decodeURIComponent(parts[parts.length - 1]);
	return null;
}

export const getCollection = async (req, res) => {
	try {
		const collection = resolveCollection(req);
		if (!collection) {
			return res.status(400).json({ message: 'Missing collection name in URL' });
		}
		if (!ALLOWED_COLLECTIONS.has(collection)) {
			return res.status(404).json({ message: 'Unknown collection' });
		}

		if (memCache.has(collection)) {
			res.setHeader('Cache-Control', 'private, max-age=600');
			res.setHeader('X-Data-Cache', 'HIT');
			return res.json(memCache.get(collection));
		}

		// Prefer local JSON (instant) over Mongo for static game catalogs
		let data = readLocalJson(collection);

		if (!data) {
			const Model = modelMap[collection];
			if (Model) {
				try {
					const doc = await Model.findOne().lean();
					if (doc?.data) data = doc.data;
				} catch (dbErr) {
					console.warn(`[data] ${collection}: Mongo read failed`, dbErr?.message || dbErr);
				}
			}
		}

		if (!data) {
			return res.status(404).json({ message: `No data for ${collection}` });
		}

		memCache.set(collection, data);
		res.setHeader('Cache-Control', 'private, max-age=600');
		res.setHeader('X-Data-Cache', 'MISS');
		return res.json(data);
	} catch (err) {
		console.error('[data]', err?.message || err);
		return res.status(500).json({ message: 'Failed to load collection' });
	}
};
