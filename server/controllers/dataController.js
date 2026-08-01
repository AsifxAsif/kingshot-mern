import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { modelMap } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

const ALLOWED_COLLECTIONS = new Set([
  'heroes', 'hero_gears', 'gov_gears', 'gov_charms', 'buildings', 'troops',
  'war_academy', 'pets', 'misc', 'widgets', 'points', 'forgehammers',
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
};

function readLocalJson(collection) {
  const file = keyToFile[collection];
  if (!file) return null;
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function resolveCollection(req) {
  // 1) named route params
  if (req.params?.collection) return String(req.params.collection);
  if (req.params?.type) return String(req.params.type);
  // 2) parse from URL: /api/data/buildings → buildings
  const raw = (req.originalUrl || req.url || '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  // find "data" segment, take next
  const idx = parts.findIndex((p) => p === 'data');
  if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  // last segment fallback
  if (parts.length) return decodeURIComponent(parts[parts.length - 1]);
  return null;
}

export const getCollection = async (req, res) => {
  try {
    const collection = resolveCollection(req);
    console.log('[data]', req.method, req.originalUrl, '→ collection=', collection, 'params=', req.params);

    if (!collection) {
      return res.status(400).json({ message: 'Missing collection name in URL' });
    }

    // Only allowlist keys — blocks path tricks / unexpected collection names
    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return res.status(404).json({ message: 'Unknown collection' });
    }

    const Model = modelMap[collection];
    if (!Model) {
      return res.status(404).json({
        message: `Unknown collection: ${collection}`,
        known: Object.keys(modelMap),
      });
    }

    const doc = await Model.findOne().lean();
    if (doc?.data) {
      return res.json(doc.data);
    }

    const local = readLocalJson(collection);
    if (local) {
      console.warn(`[data] ${collection}: serving local JSON fallback`);
      return res.json(local);
    }

    return res.status(404).json({
      message: `No data for ${collection}. Run: npm run seed`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const healthCheck = (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
};

export const listCollections = (req, res) => {
  res.json({ collections: Object.keys(modelMap) });
};
