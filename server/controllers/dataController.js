import fs from 'fs';
import path from 'path';
import {
	fileURLToPath
} from 'url';
import {
	modelMap
} from '../models/index.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const ALLOWED_COLLECTIONS = new Set(['heroes', 'hero_gears', 'gov_gears', 'gov_charms', 'buildings', 'troops', 'war_academy', 'pets', 'misc', 'widgets', 'points', 'forgehammers', 'masters', ]);
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
/** Process-level cache */
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

async function loadFromMongo(collection) {
	const Model = modelMap[collection];
	if (!Model) return null;
	try {
		const doc = await Model.findOne().lean();
		if (doc?.data) return doc.data;
	} catch (dbErr) {
		console.warn(`[data] ${collection}: Mongo read failed`, dbErr?.message || dbErr);
	}
	return null;
}

export const getCollection = async (req, res) => {
	try {
		const collection = resolveCollection(req);
		if (!collection) {
			return res.status(400).json({
				message: 'Missing collection name in URL'
			});
		}
		if (!ALLOWED_COLLECTIONS.has(collection)) {
			return res.status(404).json({
				message: 'Unknown collection'
			});
		}

		// ?refresh=1 or header forces reload from Mongo/file
		const forceRefresh =
			String(req.query?.refresh || '') === '1' ||
			String(req.headers['x-data-refresh'] || '') === '1';
		if (forceRefresh) {
			memCache.delete(collection);
		}

		if (memCache.has(collection)) {
			res.setHeader('Cache-Control', 'private, max-age=60');
			res.setHeader('X-Data-Cache', 'HIT');
			return res.json(memCache.get(collection));
		}

		// Prefer MongoDB (your live catalog), fall back to local JSON files
		let data = await loadFromMongo(collection);
		let source = 'mongo';
		if (!data) {
			data = readLocalJson(collection);
			source = 'file';
		}
		if (!data) {
			return res.status(404).json({
				message: `No data for ${collection}`
			});
		}
		memCache.set(collection, data);
		res.setHeader('Cache-Control', 'private, max-age=60');
		res.setHeader('X-Data-Cache', 'MISS');
		res.setHeader('X-Data-Source', source);
		return res.json(data);
	} catch (err) {
		console.error('[data]', err?.message || err);
		return res.status(500).json({
			message: 'Failed to load collection'
		});
	}
};
