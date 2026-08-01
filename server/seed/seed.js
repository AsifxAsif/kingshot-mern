import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import { modelMap, Preset } from '../models/index.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

const fileToKey = {
  'Hero.json': 'heroes',
  'Hero_Gear.json': 'hero_gears',
  'Gov_Gear.json': 'gov_gears',
  'Gov_Charm.json': 'gov_charms',
  'Buildings.json': 'buildings',
  'Troops.json': 'troops',
  'War_Academy.json': 'war_academy',
  'Pet.json': 'pets',
  'Misc.json': 'misc',
  'Widgets.json': 'widgets',
  'Points.json': 'points',
  'Forgehammer.json': 'forgehammers',
};

async function seed() {
  await connectDB();
  console.log('Seeding game data...\n');

  for (const [file, key] of Object.entries(fileToKey)) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Missing: ${file}`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const Model = modelMap[key];
    await Model.deleteMany({});
    await Model.create({ data: raw });
    console.log(`  ✓ ${key}`);
  }

  // Ensure default preset exists
  const existing = await Preset.findOne({ name: 'default' });
  if (!existing) {
    await Preset.create({ name: 'default', vault: {} });
    console.log('  ✓ default preset created');
  } else {
    console.log('  ✓ default preset already exists');
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
