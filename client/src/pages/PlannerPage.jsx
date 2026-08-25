import { useMemo, useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useGameData } from '../hooks/useGameData';
import {
  parseCost,
  parseTimeToSeconds,
  formatNumber,
  formatSecondsToTime,
  getUpgradeSteps,
  SCORE_RULES,
} from '../utils/calc';
import { normalizeCostMap } from '../utils/resources';
import AssetImg from '../components/AssetImg';
import { buildingImg, warAcademyImg, asset, petImg } from '../utils/images';

/** Fixed 7-day Strongest Governor schedule */
export const EVENT_DAYS = [
  {
    day: 1,
    title: 'City Construction',
    categories: ['buildings', 'warAcademy', 'govCharm'],
    sources: [
      'Buildings (Truegold / Tempered Truegold)',
      'War Academy (Truegold Dust)',
      'Governor Charm',
      'Construction / Research / Training speedups',
    ],
  },
  {
    day: 2,
    title: 'Hero Development',
    categories: ['heroes', 'widgets', 'heroGear', 'buildings', 'warAcademy', 'miscRoulette'],
    sources: [
      'Hero shards & Hero Roulette',
      'Widgets, Mithril, Forgehammer',
      'Truegold / Dust / Tempered Truegold',
    ],
  },
  {
    day: 3,
    title: 'Basic Skill Up',
    categories: ['heroes', 'pets', 'govCharm', 'miscRoulette'],
    sources: ['Hero shards & Roulette', 'Pets / Taming Marks', 'Governor Charm'],
  },
  {
    day: 4,
    title: 'Combat Training',
    categories: ['troops', 'widgets', 'heroGear', 'govCharm'],
    sources: ['Troops', 'Widgets / Hero Gear', 'Governor Charm'],
  },
  {
    day: 5,
    title: 'Power Boost',
    categories: ['buildings', 'warAcademy', 'widgets', 'heroGear'],
    sources: ['Buildings & Research', 'Widgets / Hero Gear'],
  },
  {
    day: 6,
    title: 'Combat Training',
    categories: ['troops', 'govGear'],
    sources: ['Troops', 'Governor Gear'],
  },
  {
    day: 7,
    title: 'Final Hero Development',
    categories: ['heroes', 'pets', 'buildings', 'warAcademy', 'govGear', 'miscGather'],
    sources: ['Heroes, Pets, Buildings, Research, Gov Gear, Gathering'],
  },
];

const CATEGORY_META = {
  buildings: { label: 'Buildings', order: 1 },
  warAcademy: { label: 'War Academy', order: 2 },
  govCharm: { label: 'Governor Charm', order: 3 },
  govGear: { label: 'Governor Gear', order: 4 },
  heroGear: { label: 'Hero Gear', order: 5 },
  widgets: { label: 'Widgets', order: 6 },
  heroes: { label: 'Heroes', order: 7 },
  pets: { label: 'Pets', order: 8 },
  troops: { label: 'Troops', order: 9 },
  miscRoulette: { label: 'Hero Roulette', order: 10 },
  miscGather: { label: 'Gathering', order: 11 },
};

const COST_ALIASES = {
  threads: 'gilded_threads',
  artisans: 'artisans_vision',
  guides: 'charm_guide',
  designs: 'charm_design',
  forgehammer: 'forge_hammer',
};

function getPetAdvancementPoints(targetLevelStr) {
  const levelStr = String(targetLevelStr).toLowerCase().trim();
  const match = levelStr.match(/^(\d+)_[Aa]dvancement$/);
  if (!match) return 0;
  const baseMilestone = parseInt(match[1], 10);
  const milestoneMap = {
    10: 500, 20: 1000, 30: 2000, 40: 3000, 50: 4500,
    60: 6750, 70: 10000, 80: 12000, 90: 14500, 100: 17500,
  };
  return (milestoneMap[baseMilestone] || 0) * 50;
}

function rowLevel(step) {
  if (!step) return '';
  return String(step.level ?? step.target_lvl ?? step.target ?? step.to ?? '');
}

function addCost(costs, key, val) {
  const n = parseCost(val);
  if (!n) return;
  const k = COST_ALIASES[key] || (key === 'forgehammer' ? 'forge_hammer' : key);
  costs[k] = (costs[k] || 0) + n;
}

function stepResourceCosts(step) {
  const costs = {};
  if (!step) return costs;
  const keys = [
    'bread', 'wood', 'stone', 'iron', 'gold', 'truegold', 'tempered_truegold',
    'truegold_dust', 'widgets', 'forge_hammer', 'forgehammer', 'mithril', 'satin',
    'gilded_threads', 'threads', 'artisans_vision', 'artisans', 'charm_guide',
    'guides', 'charm_design', 'designs', 'pet_food', 'growth_manual',
    'nutrient_potion', 'promotion_medallion', 'advanced_taming_mark', 'common_taming_mark',
  ];
  for (const k of keys) {
    if (step[k] != null) addCost(costs, k, step[k]);
  }
  return costs;
}

function mergeCosts(maps) {
  const out = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m || {})) {
      if (v) out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

function buildTargetOrder(rows) {
  const order = { '0': 0, '': 0 };
  let i = 1;
  const seen = new Set();
  for (const item of rows || []) {
    const t = item.target;
    if (t != null && t !== 'null' && !seen.has(String(t))) {
      seen.add(String(t));
      order[String(t)] = i++;
    }
  }
  return order;
}

function getTargetSteps(rows, from, to, order) {
  const fromO = order[String(from ?? '0')] ?? 0;
  const toO = order[String(to)] ?? -1;
  if (toO <= fromO) return [];
  return (rows || []).filter((item) => {
    const t = item.target != null ? String(item.target) : null;
    if (!t) return false;
    const o = order[t] ?? -1;
    return o > fromO && o <= toO;
  });
}

function allowedDaysForCategory(category) {
  return EVENT_DAYS.filter((d) => d.categories.includes(category)).map((d) => d.day);
}

/**
 * Build one plan item per active upgrade (whole path totals).
 * Buildings / War Academy also expose optional stepSegments for splitting.
 */
function collectPlanItems(state, dataMap) {
  const items = [];

  // —— Buildings ——
  const bData = dataMap.buildings || {};
  for (const [name, s] of Object.entries(state.buildings || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getUpgradeSteps(bData[name] || [], s.from || '0', s.to);
    if (!steps.length) continue;
    let points = 0;
    let timeSec = 0;
    const costs = {};
    const segments = [];
    for (const st of steps) {
      const sc = stepResourceCosts(st);
      Object.assign(costs, mergeCosts([costs, sc]));
      const t = parseTimeToSeconds(st.time);
      timeSec += t;
      let pts =
        parseCost(st.truegold) * (SCORE_RULES.truegold || 0) +
        parseCost(st.tempered_truegold) * (SCORE_RULES.tempered_truegold || 0);
      if (s.speedup && t > 0) {
        const mins = Math.ceil(t / 60);
        costs.building_speedup = (costs.building_speedup || 0) + mins;
        pts += mins * (SCORE_RULES.speedup_min || 30);
      }
      points += pts;
      const lvl = rowLevel(st);
      segments.push({
        key: `buildings:${name}:${lvl}`,
        label: `→ ${lvl}`,
        points: pts,
        timeSec: t,
        costs: sc,
      });
    }
    items.push({
      id: `buildings:${name}`,
      category: 'buildings',
      page: 'Buildings',
      name,
      path: `${s.from || '0'} → ${s.to}`,
      points,
      timeSec,
      costs,
      stepCount: steps.length,
      segments,
      canSplit: segments.length > 1,
      img: buildingImg(name),
    });
  }

  // —— War Academy ——
  const waRoot = dataMap.war_academy || {};
  const waData = waRoot['War Academy'] || waRoot;
  for (const [name, s] of Object.entries(state.warAcademy || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getUpgradeSteps(waData[name] || [], s.from || '0', s.to);
    if (!steps.length) continue;
    let points = 0;
    let timeSec = 0;
    const costs = {};
    const segments = [];
    for (const st of steps) {
      const sc = stepResourceCosts(st);
      Object.assign(costs, mergeCosts([costs, sc]));
      const t = parseTimeToSeconds(st.time);
      timeSec += t;
      let pts = parseCost(st.truegold_dust) * (SCORE_RULES.truegold_dust || 0);
      if (s.speedup && t > 0) {
        const mins = Math.ceil(t / 60);
        costs.research_speedup = (costs.research_speedup || 0) + mins;
        pts += mins * (SCORE_RULES.speedup_min || 30);
      }
      points += pts;
      const lvl = rowLevel(st);
      segments.push({
        key: `warAcademy:${name}:${lvl}`,
        label: `→ lvl ${lvl}`,
        points: pts,
        timeSec: t,
        costs: sc,
      });
    }
    items.push({
      id: `warAcademy:${name}`,
      category: 'warAcademy',
      page: 'War Academy',
      name,
      path: `${s.from || '0'} → ${s.to}`,
      points,
      timeSec,
      costs,
      stepCount: steps.length,
      segments,
      canSplit: segments.length > 1,
      img: warAcademyImg(name),
    });
  }

  // —— Pets ——
  const petRoot = dataMap.pets || {};
  const petData = petRoot.Pet || petRoot.Pets || petRoot;
  for (const [name, s] of Object.entries(state.pets || {})) {
    if (name === 'tamingMarks' || !s?.active || !s.to) continue;
    const rows = Array.isArray(petData[name]) ? petData[name] : [];
    const steps = getUpgradeSteps(rows, s.from || '0', s.to);
    if (!steps.length) continue;
    let points = 0;
    let timeSec = 0;
    const costs = {};
    const segments = [];
    for (const st of steps) {
      const sc = stepResourceCosts(st);
      Object.assign(costs, mergeCosts([costs, sc]));
      const t = parseTimeToSeconds(st.time);
      timeSec += t;
      const targetLvl = st.target_lvl || st.target || st.level;
      const advPts = getPetAdvancementPoints(targetLvl);
      const pts =
        advPts > 0 ? advPts : parseCost(st.point ?? st.points ?? st.score ?? 0);
      points += pts;
      const lvl = rowLevel(st) || String(targetLvl);
      segments.push({
        key: `pets:${name}:${lvl}`,
        label: `→ ${lvl}`,
        points: pts,
        timeSec: t,
        costs: sc,
      });
    }
    items.push({
      id: `pets:${name}`,
      category: 'pets',
      page: 'Pets',
      name,
      path: `${s.from || '0'} → ${s.to}`,
      points,
      timeSec,
      costs,
      stepCount: steps.length,
      segments,
      canSplit: segments.length > 1,
      img: (typeof petImg === 'function' ? petImg(name) : null) || asset('grey_wolf.webp'),
    });
  }

  // Taming marks (settings)
  const tm = state.settings?.tamingMarks || state.pets?.tamingMarks || {};
  const tmAdv = parseCost(tm.advanced);
  const tmCommon = parseCost(tm.common);
  if (tm.active && (tmAdv > 0 || tmCommon > 0)) {
    const tmPts =
      tmAdv * (SCORE_RULES.advanced_taming_mark || 15000) +
      tmCommon * (SCORE_RULES.common_taming_mark || 1150);
    items.push({
      id: 'pets:tamingMarks',
      category: 'pets',
      page: 'Pets',
      name: 'Taming Marks',
      path: `Adv ${tmAdv} · Common ${tmCommon}`,
      points: tmPts,
      timeSec: 0,
      costs: {
        ...(tmAdv ? { advanced_taming_mark: tmAdv } : {}),
        ...(tmCommon ? { common_taming_mark: tmCommon } : {}),
      },
      stepCount: 1,
      segments: [],
      canSplit: false,
    });
  }

  // —— Gov Gear ——
  const ggData = dataMap.gov_gears || {};
  const gearRows = ggData['GOV Gear'] || [];
  const gearOrder = buildTargetOrder(gearRows);
  for (const [name, s] of Object.entries(state.govGear || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getTargetSteps(gearRows, s.from || '0', s.to, gearOrder);
    if (!steps.length) continue;
    let points = 0;
    const costs = {};
    const segments = [];
    for (const st of steps) {
      const sc = stepResourceCosts(st);
      Object.assign(costs, mergeCosts([costs, sc]));
      const pts = parseCost(st.point) * (SCORE_RULES.gov_gear_score || 36);
      points += pts;
      const lvl = rowLevel(st);
      segments.push({
        key: `govGear:${name}:${lvl}`,
        label: `→ ${lvl}`,
        points: pts,
        timeSec: 0,
        costs: sc,
      });
    }
    items.push({
      id: `govGear:${name}`,
      category: 'govGear',
      page: 'Gov Gear',
      name,
      path: `${s.from || '0'} → ${s.to}`,
      points,
      timeSec: 0,
      costs,
      stepCount: steps.length,
      segments,
      canSplit: segments.length > 1,
    });
  }

  // —— Gov Charm ——
  const gcData = dataMap.gov_charms || {};
  const charmRows = gcData['GOV Charm'] || [];
  const charmOrder = buildTargetOrder(charmRows);
  for (const [name, s] of Object.entries(state.govCharm || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getTargetSteps(charmRows, s.from || '0', s.to, charmOrder);
    if (!steps.length) continue;
    let points = 0;
    const costs = {};
    const segments = [];
    for (const st of steps) {
      const sc = stepResourceCosts(st);
      Object.assign(costs, mergeCosts([costs, sc]));
      const pts = parseCost(st.point) * (SCORE_RULES.gov_charm_score || 70);
      points += pts;
      const lvl = rowLevel(st);
      segments.push({
        key: `govCharm:${name}:${lvl}`,
        label: `→ ${lvl}`,
        points: pts,
        timeSec: 0,
        costs: sc,
      });
    }
    items.push({
      id: `govCharm:${name}`,
      category: 'govCharm',
      page: 'Gov Charm',
      name,
      path: `${s.from || '0'} → ${s.to}`,
      points,
      timeSec: 0,
      costs,
      stepCount: steps.length,
      segments,
      canSplit: segments.length > 1,
    });
  }

  // —— Hero Gear ——
  const hgData = dataMap.hero_gears || dataMap.hero_gear || {};
  const hgRows = hgData['Hero Gear'] || (Array.isArray(hgData) ? hgData : []);
  const hg = state.heroGear || {};
  for (const item of hg.items || []) {
    if (!item?.active || !item.to) continue;
    const steps = getUpgradeSteps(hgRows, item.from || '0', item.to);
    if (!steps.length) continue;
    let points = 0;
    const costs = {};
    for (const st of steps) {
      Object.assign(costs, mergeCosts([costs, stepResourceCosts(st)]));
      points +=
        parseCost(st.mithril) * (SCORE_RULES.mithril || 0) +
        parseCost(st.forgehammer || st.forge_hammer) * (SCORE_RULES.forge_hammer || 0);
    }
    const id = item.id || 'gear';
    items.push({
      id: `heroGear:${id}`,
      category: 'heroGear',
      page: 'Hero Gear',
      name: `Gear #${id}`,
      path: `${item.from || '0'} → ${item.to}`,
      points,
      timeSec: 0,
      costs,
      stepCount: steps.length,
      segments: [],
      canSplit: false,
    });
  }
  for (const item of hg.forgeItems || []) {
    if (!item?.active || !item.to) continue;
    const forgeRows = hgData.Forge || hgData.Forgehammer || hgRows;
    const steps = getUpgradeSteps(forgeRows, item.from || '0', item.to);
    if (!steps.length) continue;
    let points = 0;
    const costs = {};
    for (const st of steps) {
      Object.assign(costs, mergeCosts([costs, stepResourceCosts(st)]));
      points +=
        parseCost(st.mithril) * (SCORE_RULES.mithril || 0) +
        parseCost(st.forgehammer || st.forge_hammer) * (SCORE_RULES.forge_hammer || 0);
    }
    const id = item.id || 'forge';
    items.push({
      id: `heroForge:${id}`,
      category: 'heroGear',
      page: 'Hero Gear',
      name: `Forge #${id}`,
      path: `${item.from || '0'} → ${item.to}`,
      points,
      timeSec: 0,
      costs,
      stepCount: steps.length,
      segments: [],
      canSplit: false,
    });
  }

  // —— Widgets ——
  const wRows = (dataMap.widgets || {}).Widgets || [];
  for (const [name, s] of Object.entries(state.widgets || {})) {
    if (!s?.active) continue;
    const from = parseInt(s.from, 10) || 0;
    const to = parseInt(s.to, 10) || 0;
    if (to <= from) continue;
    let points = 0;
    let widgets = 0;
    const segments = [];
    for (const row of wRows) {
      const cur = Number(row.current_lvl);
      const tgt = Number(row.target_lvl);
      if (cur >= from && tgt <= to && tgt > from) {
        const w = parseCost(row.widgets);
        widgets += w;
        const pts = w * (SCORE_RULES.widgets || 0);
        points += pts;
        segments.push({
          key: `widgets:${name}:${tgt}`,
          label: `${cur}→${tgt}`,
          points: pts,
          timeSec: 0,
          costs: w ? { widgets: w } : {},
        });
      }
    }
    if (!segments.length) continue;
    items.push({
      id: `widgets:${name}`,
      category: 'widgets',
      page: 'Widgets',
      name,
      path: `${from} → ${to}`,
      points,
      timeSec: 0,
      costs: widgets ? { widgets } : {},
      stepCount: segments.length,
      segments,
      canSplit: segments.length > 1,
    });
  }

  // —— Troops ——
  const troopsData = dataMap.troops || {};
  const training = troopsData?.Troops?.Training || troopsData?.Training || {};
  const promoting = troopsData?.Troops?.Promoting || troopsData?.Promoting || {};
  for (const [key, s] of Object.entries(state.troops || {})) {
    if (!s?.active) continue;
    if (key.startsWith('train_')) {
      const type = key.replace('train_', '');
      const level = parseInt(s.level, 10) || 0;
      const qty = parseFloat(s.qty) || 0;
      if (!level || !qty) continue;
      const row = (training[type] || []).find((r) => r.lvl === level || Number(r.lvl) === level);
      if (!row) continue;
      const costs = {};
      for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
        if (row[k] != null) costs[k] = parseCost(row[k]) * qty;
      }
      let points = (row.point || SCORE_RULES.troops?.[level] || 0) * qty;
      const timeSec = parseTimeToSeconds(row.time) * qty;
      if (s.speedup && timeSec > 0) {
        const mins = Math.ceil(timeSec / 60);
        costs.training_speedup = mins;
        points += mins * (SCORE_RULES.speedup_min || 30);
      }
      items.push({
        id: `troops:${key}`,
        category: 'troops',
        page: 'Troops',
        name: `Train ${type} T${level} ×${qty}`,
        path: `T${level}`,
        points,
        timeSec,
        costs,
        stepCount: 1,
        segments: [],
        canSplit: false,
      });
    } else if (key.startsWith('promo_')) {
      const type = key.replace('promo_', '');
      const from = parseInt(s.from, 10) || 0;
      const to = parseInt(s.to, 10) || 0;
      const qty = parseFloat(s.qty) || 0;
      if (!(from > 0 && to > from && qty > 0)) continue;
      const rows = promoting[type] || [];
      const chain = [];
      let cur = from;
      for (let guard = 0; guard < 20 && cur < to; guard++) {
        const row = rows.find((r) => Number(r.current_lvl) === cur);
        if (!row) break;
        chain.push(row);
        cur = Number(row.target_lvl);
        if (cur === to) break;
      }
      if (!chain.length || Number(chain[chain.length - 1].target_lvl) !== to) continue;
      const costs = {};
      let timeSec = 0;
      for (const row of chain) {
        for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
          if (row[k] != null) costs[k] = (costs[k] || 0) + parseCost(row[k]) * qty;
        }
        timeSec += parseTimeToSeconds(row.time) * qty;
      }
      let points = Math.max(
        0,
        ((SCORE_RULES.troops?.[to] || 0) - (SCORE_RULES.troops?.[from] || 0)) * qty
      );
      if (s.speedup && timeSec > 0) {
        const mins = Math.ceil(timeSec / 60);
        costs.training_speedup = mins;
        points += mins * (SCORE_RULES.speedup_min || 30);
      }
      items.push({
        id: `troops:${key}`,
        category: 'troops',
        page: 'Troops',
        name: `Promo ${type} T${from}→T${to} ×${qty}`,
        path: `T${from} → T${to}`,
        points,
        timeSec,
        costs,
        stepCount: chain.length,
        segments: [],
        canSplit: false,
      });
    }
  }

  // —— Heroes (use page score is hard; estimate from active flag + stored if any) ——
  // Prefer locked costs / simple: if heroes page stored nothing, show active heroes
  // with points from pageScores only as group is imperfect — try flower state
  const flowerStates = state.heroes?._flowers || state.heroFlowers || {};
  for (const [name, s] of Object.entries(state.heroes || {})) {
    if (name.startsWith('_') || !s?.active) continue;
    // Points often live only after calc on Heroes page — use pageScores share not available per hero.
    // Show path info; points from optional s.points if set by page.
    items.push({
      id: `heroes:${name}`,
      category: 'heroes',
      page: 'Heroes',
      name,
      path: s.from && s.to ? `${s.from} → ${s.to}` : 'Star upgrade',
      points: parseCost(s.points) || 0,
      timeSec: 0,
      costs: {},
      stepCount: 1,
      segments: [],
      canSplit: false,
      note:
        (parseCost(s.points) || 0) > 0
          ? null
          : 'Open Heroes page so shard points calculate; total is in navbar HEROES SCORE',
    });
  }

  // —— Misc ——
  const misc = state.misc || {};
  if (misc.rouletteActive && parseCost(misc.roulette) > 0) {
    const spins = parseCost(misc.roulette);
    items.push({
      id: 'misc:roulette',
      category: 'miscRoulette',
      page: 'Misc',
      name: 'Hero Roulette',
      path: `×${spins} spins`,
      points: spins * (SCORE_RULES.roulette || 8000),
      timeSec: 0,
      costs: {},
      stepCount: 1,
      segments: [],
      canSplit: false,
    });
  }
  if (misc.gatherActive) {
    // Use page score fragment if present is hard; show marker with misc page score note
    const gatherPts = parseCost(state.pageScores?.misc) || 0;
    // Only gathering portion unknown — still list for scheduling
    items.push({
      id: 'misc:gather',
      category: 'miscGather',
      page: 'Misc',
      name: 'Gathering',
      path: 'Marches / bison',
      points: 0,
      timeSec: 0,
      costs: {},
      stepCount: 1,
      segments: [],
      canSplit: false,
      note: 'Points follow Misc page gathering total (see MISC SCORE)',
    });
  }

  return items;
}

export default function PlannerPage() {
  const { state, updateSection } = useApp();
  const b = useGameData('buildings');
  const wa = useGameData('war_academy');
  const pets = useGameData('pets');
  const gg = useGameData('gov_gears');
  const gc = useGameData('gov_charms');
  const hg = useGameData('hero_gears');
  const widgets = useGameData('widgets');
  const troops = useGameData('troops');

  const loading =
    b.loading ||
    wa.loading ||
    pets.loading ||
    gg.loading ||
    gc.loading ||
    hg.loading ||
    widgets.loading ||
    troops.loading;

  const planner = state.planner || {};
  const selectedDay = Math.min(7, Math.max(1, parseInt(planner.selectedDay || '1', 10) || 1));
  /** Per-segment day: assignments[segmentKey] = 1..7 */
  const assignments = planner.assignments || {};

  const setPlanner = useCallback(
    (patch) => updateSection('planner', (prev) => ({ ...(prev || {}), ...patch })),
    [updateSection]
  );

  const setSegmentDay = (key, day) => {
    updateSection('planner', (prev) => ({
      ...(prev || {}),
      assignments: { ...(prev?.assignments || {}), [key]: day },
    }));
  };

  const setSegmentsDay = (keys, day) => {
    updateSection('planner', (prev) => {
      const next = { ...(prev?.assignments || {}) };
      for (const k of keys) next[k] = day;
      return { ...(prev || {}), assignments: next };
    });
  };

  const dataMap = useMemo(
    () => ({
      buildings: b.data,
      war_academy: wa.data,
      pets: pets.data,
      gov_gears: gg.data,
      gov_charms: gc.data,
      hero_gears: hg.data,
      widgets: widgets.data,
      troops: troops.data,
    }),
    [b.data, wa.data, pets.data, gg.data, gc.data, hg.data, widgets.data, troops.data]
  );

  const planItems = useMemo(() => {
    const raw = collectPlanItems(state, dataMap);
    // Ensure every item has at least one segment for day scheduling
    return raw.map((it) => {
      if (it.segments && it.segments.length) return it;
      return {
        ...it,
        segments: [
          {
            key: `${it.id}:all`,
            label: it.path || it.name,
            points: it.points || 0,
            timeSec: it.timeSec || 0,
            costs: it.costs || {},
          },
        ],
        canSplit: false,
      };
    });
  }, [state, dataMap]);

  const effectiveSegDay = useCallback(
    (seg, category) => {
      const allowed = allowedDaysForCategory(category);
      if (!allowed.length) return 1;
      const a = assignments[seg.key];
      if (a != null && allowed.includes(Number(a))) return Number(a);
      return allowed[0];
    },
    [assignments]
  );

  const dayInfo = EVENT_DAYS[selectedDay - 1];

  /** Items with only the segments scheduled on selected day */
  const dayItems = useMemo(() => {
    const out = [];
    for (const it of planItems) {
      const segs = (it.segments || []).filter(
        (seg) => effectiveSegDay(seg, it.category) === selectedDay
      );
      if (!segs.length) continue;
      const points = segs.reduce((s, x) => s + (x.points || 0), 0);
      const timeSec = segs.reduce((s, x) => s + (x.timeSec || 0), 0);
      const costs = mergeCosts(segs.map((x) => x.costs));
      out.push({
        ...it,
        segments: segs,
        points,
        timeSec,
        costs,
        stepCount: segs.length,
      });
    }
    return out;
  }, [planItems, effectiveSegDay, selectedDay]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of dayItems) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category).push(it);
    }
    return [...map.entries()]
      .map(([category, list]) => ({
        category,
        label: CATEGORY_META[category]?.label || category,
        order: CATEGORY_META[category]?.order ?? 99,
        list,
      }))
      .sort((a, b) => a.order - b.order);
  }, [dayItems]);

  const summary = useMemo(() => {
    let points = 0;
    let timeSec = 0;
    const costs = {};
    for (const it of dayItems) {
      points += it.points || 0;
      timeSec += it.timeSec || 0;
      Object.assign(costs, mergeCosts([costs, it.costs]));
    }
    return { points, timeSec, costs, count: dayItems.reduce((n, it) => n + it.segments.length, 0) };
  }, [dayItems]);

  const countByDay = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    const p = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    for (const it of planItems) {
      for (const seg of it.segments || []) {
        const d = effectiveSegDay(seg, it.category);
        c[d] = (c[d] || 0) + 1;
        p[d] = (p[d] || 0) + (seg.points || 0);
      }
    }
    return { c, p };
  }, [planItems, effectiveSegDay]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading planner…</p>
      </div>
    );
  }

  return (
    <div className="calculator-page planner-page">
      <div
        className="planner-day-tabs"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}
      >
        {EVENT_DAYS.map((d) => (
          <button
            key={d.day}
            type="button"
            className="preset-btn"
            style={{
              fontWeight: selectedDay === d.day ? 700 : 500,
              opacity: selectedDay === d.day ? 1 : 0.72,
              borderWidth: selectedDay === d.day ? 2 : 1,
            }}
            onClick={() => setPlanner({ selectedDay: d.day })}
          >
            Day {d.day}
            <span style={{ opacity: 0.8, marginLeft: 6 }}>
              {d.title.split(' ')[0]}
              {countByDay.c[d.day] ? ` · ${countByDay.c[d.day]}` : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="item-card planner-day-summary" style={{ marginBottom: 16 }}>
        <div className="item-card-header">
          <span>
            Day {dayInfo.day} · {dayInfo.title}
          </span>
        </div>
        <div className="item-card-body">
          <div style={{ fontSize: '0.88rem', opacity: 0.9, marginBottom: 10 }}>
            Scores today from: {dayInfo.sources.join(' · ')}
          </div>
          <div className={`status-pane ${summary.count ? 'status-ok' : 'status-info'}`}>
            <div>
              Steps on this day: <strong>{summary.count}</strong>
            </div>
            <div>
              Estimated points: <strong>+{formatNumber(summary.points)}</strong>
            </div>
            <div>
              Base time: <strong>{formatSecondsToTime(summary.timeSec)}</strong>
            </div>
            {Object.keys(summary.costs).length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
                {Object.entries(normalizeCostMap(summary.costs)).map(([k, v]) =>
                  v > 0 ? (
                    <div key={k}>
                      {k.replace(/_/g, ' ')}: <strong>{formatNumber(v)}</strong>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!planItems.length && (
        <div className="status-pane status-warning">
          No active upgrades. On category pages set levels and check <strong>Upgrade</strong>, then
          return here to place steps on event days.
        </div>
      )}

      {planItems.length > 0 && !dayItems.length && (
        <div className="status-pane status-info">
          No steps scheduled on Day {dayInfo.day}. Open another day or use <em>All steps →</em> /{' '}
          <em>Move to</em> to move segments here.
        </div>
      )}

      {grouped.map((g) => (
        <section key={g.category} style={{ marginBottom: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              marginBottom: 10,
              borderRadius: 10,
              background: 'var(--hover-fill)',
              border: '1px solid var(--border-color)',
            }}
          >
            <strong>{g.label}</strong>
            <span style={{ opacity: 0.75, fontSize: '0.85rem' }}>
              {g.list.reduce((n, i) => n + i.segments.length, 0)} steps · +
              {formatNumber(g.list.reduce((s, i) => s + (i.points || 0), 0))} pts
            </span>
          </div>
          <div className="items-grid cards-grid">
            {g.list.map((it) => {
              const allowed = allowedDaysForCategory(it.category);
              // Full path segment keys (all days) for bulk — use parent from planItems
              const full = planItems.find((x) => x.id === it.id) || it;
              const allKeys = (full.segments || []).map((s) => s.key);
              const segDays = (full.segments || []).map((s) =>
                effectiveSegDay(s, it.category)
              );
              const allSame = segDays.length > 0 && segDays.every((d) => d === segDays[0]);
              const bulkValue = allSame ? String(segDays[0]) : '';

              return (
                <div className="item-card" key={it.id}>
                  <div
                    className="item-card-header"
                    style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                  >
                    {it.img ? <AssetImg src={it.img} size={36} /> : null}
                    <span style={{ fontWeight: 700 }}>{it.name}</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        opacity: 0.65,
                        textTransform: 'uppercase',
                      }}
                    >
                      {it.page}
                    </span>
                    {allowed.length > 0 && allKeys.length > 0 && (
                      <label
                        style={{
                          marginLeft: 'auto',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.8rem',
                        }}
                        title="Schedule every step of this path to the same day"
                      >
                        <span style={{ opacity: 0.85 }}>All steps →</span>
                        <select
                          value={bulkValue}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setSegmentsDay(allKeys, parseInt(v, 10));
                          }}
                        >
                          {!allSame && (
                            <option value="" disabled>
                              Mixed days
                            </option>
                          )}
                          {allowed.map((d) => (
                            <option key={d} value={d}>
                              Day {d}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="item-card-body">
                    {it.path && (
                      <div style={{ fontSize: '0.88rem', marginBottom: 8, opacity: 0.9 }}>
                        Path: <strong>{it.path}</strong>
                        <span style={{ opacity: 0.7 }}>
                          {' '}
                          · showing {it.segments.length}
                          {full.segments && full.segments.length !== it.segments.length
                            ? ` / ${full.segments.length}`
                            : ''}{' '}
                          step
                          {it.segments.length === 1 ? '' : 's'} today
                        </span>
                      </div>
                    )}
                    <div className="status-pane status-ok" style={{ marginBottom: 10 }}>
                      <div>
                        Points today: <strong>+{formatNumber(it.points)}</strong>
                      </div>
                      {it.timeSec > 0 && (
                        <div>
                          Time today: <strong>{formatSecondsToTime(it.timeSec)}</strong>
                        </div>
                      )}
                    </div>
                    {it.segments.map((seg) => {
                      const day = effectiveSegDay(seg, it.category);
                      return (
                        <div
                          key={seg.key}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 8,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'var(--hover-fill)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div style={{ flex: '1 1 140px' }}>
                            <div style={{ fontWeight: 600 }}>{seg.label}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                              +{formatNumber(seg.points)} pts
                              {seg.timeSec > 0 && <> · {formatSecondsToTime(seg.timeSec)}</>}
                            </div>
                          </div>
                          {allowed.length > 1 ? (
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: '0.8rem',
                              }}
                            >
                              Move to
                              <select
                                value={day}
                                onChange={(e) =>
                                  setSegmentDay(seg.key, parseInt(e.target.value, 10))
                                }
                              >
                                {allowed.map((d) => (
                                  <option key={d} value={d}>
                                    Day {d}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                              Day {allowed[0]} only
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {it.note && (
                      <div style={{ marginTop: 6, opacity: 0.8, fontSize: '0.8rem' }}>{it.note}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
