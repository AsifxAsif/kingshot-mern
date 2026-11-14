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

/** Process-level cache */
const memCache = new Map();
let catalogVersionCache = { value: null, at: 0 };
const CATALOG_VERSION_TTL_MS = 30 * 1000;

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

/**
 * Stable version string that changes whenever any catalog is re-seeded
 * (Mongo updatedAt) or a local JSON file is replaced (mtime).
 * Clients compare this to localStorage and auto-clear caches on mismatch.
 */
export async function computeCatalogVersion() {
	const now = Date.now();
	if (catalogVersionCache.value && now - catalogVersionCache.at < CATALOG_VERSION_TTL_MS) {
		return catalogVersionCache.value;
	}

	const stamps = [];

	for (const [key, Model] of Object.entries(modelMap)) {
		try {
			const doc = await Model.findOne().select('updatedAt').lean();
			if (doc?.updatedAt) stamps.push(`${key}:${new Date(doc.updatedAt).toISOString()}`);
		} catch {
			/* skip */
		}
	}

	for (const file of Object.values(keyToFile)) {
		try {
			const fp = path.join(dataDir, file);
			if (fs.existsSync(fp)) {
				const st = fs.statSync(fp);
				stamps.push(`${file}:${st.mtimeMs}`);
			}
		} catch {
			/* skip */
		}
	}

	stamps.sort();
	// Compact fingerprint (length + first/last) keeps payload small but changes on any stamp change
	const joined = stamps.join('|');
	let hash = 0;
	for (let i = 0; i < joined.length; i++) {
		hash = (hash * 31 + joined.charCodeAt(i)) >>> 0;
	}
	const value = `${stamps.length}-${hash.toString(16)}-${stamps[stamps.length - 1] || '0'}`;
	catalogVersionCache = { value, at: now };
	return value;
}

/** GET /api/catalog-version — used by the client to auto-invalidate caches */
export const getCatalogVersion = async (req, res) => {
	try {
		const version = await computeCatalogVersion();
		res.setHeader('Cache-Control', 'private, max-age=15');
		return res.json({ version });
	} catch (err) {
		console.error('[data] catalog-version', err?.message || err);
		return res.status(500).json({ message: 'Failed to compute catalog version' });
	}
};

export const getCollection = async (req, res) => {
	try {
		const collection = resolveCollection(req);
		if (!collection) {
			return res.status(400).json({ message: 'Missing collection name in URL' });
		}
		if (!ALLOWED_COLLECTIONS.has(collection)) {
			return res.status(404).json({ message: 'Unknown collection' });
		}

		const forceRefresh =
			String(req.query?.refresh || '') === '1' || String(req.headers['x-data-refresh'] || '') === '1';
		if (forceRefresh) {
			memCache.delete(collection);
			catalogVersionCache = { value: null, at: 0 };
		}

		const version = await computeCatalogVersion();
		res.setHeader('X-Catalog-Version', version);

		if (memCache.has(collection)) {
			res.setHeader('Cache-Control', 'private, max-age=60');
			res.setHeader('X-Data-Cache', 'HIT');
			return res.json(memCache.get(collection));
		}

		let data = await loadFromMongo(collection);
		let source = 'mongo';
		if (!data) {
			data = readLocalJson(collection);
			source = 'file';
		}
		if (!data) {
			return res.status(404).json({ message: `No data for ${collection}` });
		}

		memCache.set(collection, data);
		res.setHeader('Cache-Control', 'private, max-age=60');
		res.setHeader('X-Data-Cache', 'MISS');
		res.setHeader('X-Data-Source', source);
		return res.json(data);
	} catch (err) {
		console.error('[data]', err?.message || err);
		return res.status(500).json({ message: 'Failed to load collection' });
	}
};
