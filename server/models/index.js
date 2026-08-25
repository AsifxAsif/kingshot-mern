import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

function makeDataModel(name, collection) {
  const schema = new mongoose.Schema(
    { data: { type: mongoose.Schema.Types.Mixed, required: true } },
    { timestamps: true, collection }
  );
  return mongoose.models[name] || mongoose.model(name, schema);
}

export const Hero = makeDataModel('Hero', 'heroes');
export const HeroGear = makeDataModel('HeroGear', 'hero_gears');
export const GovGear = makeDataModel('GovGear', 'gov_gears');
export const GovCharm = makeDataModel('GovCharm', 'gov_charms');
export const Building = makeDataModel('Building', 'buildings');
export const Troop = makeDataModel('Troop', 'troops');
export const WarAcademy = makeDataModel('WarAcademy', 'war_academy');
export const Pet = makeDataModel('Pet', 'pets');
export const Misc = makeDataModel('Misc', 'misc');
export const Widget = makeDataModel('Widget', 'widgets');
export const Point = makeDataModel('Point', 'points');
export const Forgehammer = makeDataModel('Forgehammer', 'forgehammers');

export const modelMap = {
  heroes: Hero,
  hero_gears: HeroGear,
  gov_gears: GovGear,
  gov_charms: GovCharm,
  buildings: Building,
  troops: Troop,
  war_academy: WarAcademy,
  pets: Pet,
  misc: Misc,
  widgets: Widget,
  points: Point,
  forgehammers: Forgehammer,
};

// User presets stored entirely in MongoDB (no localStorage)
const presetSchema = new mongoose.Schema(
  {
    // null / missing = guest (anonymous default-only flow)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true },
    /** UI label; storage name always ends with _gameId */
    displayName: { type: String, default: '', trim: true },
    // Identity first (before vault / calculator data)
    username: { type: String, default: '', trim: true },
    gameId: { type: String, default: '', trim: true },
    vault: { type: mongoose.Schema.Types.Mixed, default: {} },
    troops: { type: mongoose.Schema.Types.Mixed, default: {} },
    buildings: { type: mongoose.Schema.Types.Mixed, default: {} },
    heroes: { type: mongoose.Schema.Types.Mixed, default: {} },
    heroGear: { type: mongoose.Schema.Types.Mixed, default: {} },
    govGear: { type: mongoose.Schema.Types.Mixed, default: {} },
    govCharm: { type: mongoose.Schema.Types.Mixed, default: {} },
    pets: { type: mongoose.Schema.Types.Mixed, default: {} },
    warAcademy: { type: mongoose.Schema.Types.Mixed, default: {} },
    widgets: { type: mongoose.Schema.Types.Mixed, default: {} },
    misc: { type: mongoose.Schema.Types.Mixed, default: {} },
    planner: { type: mongoose.Schema.Types.Mixed, default: {} },
    heroShards: { type: mongoose.Schema.Types.Mixed, default: {} },
    heroWidgets: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Hero flower / star progression (Heroes page)
    heroFlowers: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Per-page locked resource costs for cross-page remaining vault
    lockedUpgrades: { type: mongoose.Schema.Types.Mixed, default: {} },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Per-page scores (keys: buildings, troops, heroes, … — match setPageScore)
    pageScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'presets' }
);
presetSchema.index({ userId: 1, name: 1 }, { unique: true });


export const Preset = mongoose.models.Preset || mongoose.model('Preset', presetSchema);

export { User } from './User.js';
