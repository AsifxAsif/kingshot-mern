import { parseCost, parseResourceValue } from './calc';

/**
 * Map alternate keys from game JSON → Vault / SCORE_RULES ids.
 * Data files use mixed names (forgehammer, xp, threads, …).
 */
export const RESOURCE_ALIASES = {
  forgehammer: 'forge_hammer',
  forgehammers: 'forge_hammer',
  forge_hammers: 'forge_hammer',
  'forge hammer': 'forge_hammer',
  xp: 'hero_xp',
  exp: 'hero_xp',
  hero_exp: 'hero_xp',
  heroxp: 'hero_xp',
  threads: 'gilded_threads',
  gildedthread: 'gilded_threads',
  gilded_thread: 'gilded_threads',
  artisans: 'artisans_vision',
  artisan: 'artisans_vision',
  artisan_vision: 'artisans_vision',
  guides: 'charm_guide',
  guide: 'charm_guide',
  designs: 'charm_design',
  design: 'charm_design',
  truegolddust: 'truegold_dust',
  temperedtruegold: 'tempered_truegold',
  building_speedups: 'building_speedup',
  research_speedups: 'research_speedup',
  training_speedups: 'training_speedup',
  petfood: 'pet_food',
  growthmanual: 'growth_manual',
  nutrientpotion: 'nutrient_potion',
  promotionmedallion: 'promotion_medallion',
  advancedtamingmark: 'advanced_taming_mark',
  commontamingmark: 'common_taming_mark',
  mastermanuscript: 'master_manuscript',
  generalemblem: 'general_emblem',
  mythicgear: 'mythic_gear',
  heroroulettetoken: 'hero_roulette_token',
  roulette_token: 'hero_roulette_token',
  widget: 'widgets',
};

/** Canonical vault key for any cost/resource id from JSON or UI */
export function normalizeResourceKey(key) {
  if (key == null || key === '') return '';
  if (String(key).startsWith('_')) return String(key);
  const raw = String(key).trim();
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  if (RESOURCE_ALIASES[raw]) return RESOURCE_ALIASES[raw];
  if (RESOURCE_ALIASES[lower]) return RESOURCE_ALIASES[lower];
  // strip non-alnum for compact forms
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (RESOURCE_ALIASES[compact]) return RESOURCE_ALIASES[compact];
  return lower;
}

/** Merge a cost map onto canonical keys */

const SPEEDUP_KEYS = new Set([
  'training_speedup',
  'building_speedup',
  'research_speedup',
  'master_speedup',
  'general_speedup',
]);

export function parseVaultField(key, val) {
  if (val == null || val === '') return 0;
  const nk = normalizeResourceKey(key);
  if (SPEEDUP_KEYS.has(nk)) {
    if (typeof val === 'number') return val;
    return parseResourceValue(String(val));
  }
  return parseCost(val);
}

export function normalizeCostMap(costs = {}) {
  const out = {};
  for (const [k, v] of Object.entries(costs || {})) {
    if (k.startsWith('_')) continue;
    const n = parseCost(v);
    if (!n) continue;
    const nk = normalizeResourceKey(k);
    out[nk] = (out[nk] || 0) + n;
  }
  return out;
}

/** Read vault amount trying canonical + aliases (speedups as minutes) */
export function vaultAmount(vault = {}, key) {
  if (!vault) return 0;
  const nk = normalizeResourceKey(key);
  if (vault[nk] != null && vault[nk] !== '') return parseVaultField(nk, vault[nk]);
  if (vault[key] != null && vault[key] !== '') return parseVaultField(nk, vault[key]);
  for (const [vk, vv] of Object.entries(vault)) {
    if (normalizeResourceKey(vk) === nk) return parseVaultField(nk, vv);
  }
  return 0;
}

/**
 * remaining = vault - cost (keys normalized to vault ids)
 */
export function computeAffordability(costs, vault = {}) {
  const norm = normalizeCostMap(costs);
  const remaining = {};
  let canAfford = true;
  const keys = Object.keys(norm);
  if (keys.length === 0) return { remaining: {}, canAfford: true };

  for (const [key, need] of Object.entries(norm)) {
    const have = vaultAmount(vault, key);
    const left = have - need;
    remaining[key] = left;
    if (left < 0) canAfford = false;
  }
  return { remaining, canAfford };
}

/**
 * Sum locked cost maps from other pages.
 */
export function sumLockedCosts(lockedUpgrades = {}, excludePage = null) {
  const totals = {};
  for (const [page, costs] of Object.entries(lockedUpgrades || {})) {
    if (excludePage && page === excludePage) continue;
    if (!costs || typeof costs !== 'object') continue;
    const values = Object.values(costs);
    const looksNested =
      values.length > 0 &&
      values.every((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (looksNested) {
      for (const itemCosts of values) {
        for (const [k, amt] of Object.entries(normalizeCostMap(itemCosts))) {
          totals[k] = (totals[k] || 0) + amt;
        }
      }
    } else {
      for (const [k, amt] of Object.entries(normalizeCostMap(costs))) {
        totals[k] = (totals[k] || 0) + amt;
      }
    }
  }
  return totals;
}

/** vault after subtracting locked costs (optionally exclude one page) */
export function buildRemainingVault(vault = {}, lockedUpgrades = {}, excludePage = null) {
  const locked = sumLockedCosts(lockedUpgrades, excludePage);
  const out = { ...vault };
  for (const [k, amt] of Object.entries(locked)) {
    // write back onto canonical key; also zero aliases in out if present
    const have = vaultAmount(out, k);
    out[k] = Math.max(0, have - amt);
  }
  return out;
}

/** Subtract flat costs from vault (new object). */
export function subtractCosts(vault = {}, costs = {}) {
  const out = { ...vault };
  for (const [k, amt] of Object.entries(normalizeCostMap(costs))) {
    const have = vaultAmount(out, k);
    out[k] = Math.max(0, have - amt);
  }
  return out;
}

/** Merge several cost maps into one total. */
export function mergeCosts(costMaps = []) {
  const totals = {};
  for (const costs of costMaps) {
    for (const [k, amt] of Object.entries(normalizeCostMap(costs))) {
      totals[k] = (totals[k] || 0) + amt;
    }
  }
  return totals;
}

/**
 * Split needed speedup minutes across specific type, then general_speedup.
 * Used so building/research/training can fall back to general when specific is short.
 *
 * @returns {{ costs: Object, usedSpecific: number, usedGeneral: number, used: number, shortfall: number }}
 */
export function allocateSpeedupMinutes(needMins, specificKey, vault = {}) {
  const need = Math.max(0, Math.ceil(Number(needMins) || 0));
  if (!need || !specificKey) {
    return { costs: {}, usedSpecific: 0, usedGeneral: 0, used: 0, shortfall: 0 };
  }

  let left = need;
  const costs = {};

  const specificHave = Math.max(0, vaultAmount(vault, specificKey));
  const usedSpecific = Math.min(left, specificHave);
  if (usedSpecific > 0) {
    costs[specificKey] = usedSpecific;
    left -= usedSpecific;
  }

  const genHave = Math.max(0, vaultAmount(vault, 'general_speedup'));
  const usedGeneral = Math.min(left, genHave);
  if (usedGeneral > 0) {
    costs.general_speedup = usedGeneral;
    left -= usedGeneral;
  }

  // Still short → show deficit on general if we already exhausted specific,
  // otherwise on specific (so UI lists what is missing)
  if (left > 0) {
    if (usedSpecific <= 0 && (usedGeneral > 0 || genHave <= 0)) {
      costs.general_speedup = (costs.general_speedup || 0) + left;
    } else {
      costs[specificKey] = (costs[specificKey] || 0) + left;
    }
  }

  return {
    costs,
    usedSpecific,
    usedGeneral,
    used: usedSpecific + usedGeneral,
    shortfall: left,
  };
}

/** Strip speedup resource keys from a cost map (before re-allocating). */
export function stripSpeedupKeys(costs = {}) {
  const out = { ...normalizeCostMap(costs) };
  delete out.building_speedup;
  delete out.research_speedup;
  delete out.training_speedup;
  delete out.general_speedup;
  delete out.master_speedup;
  return out;
}

/**
 * Shared same-page affordability (all cards see each other).
 *
 * Optional per item:
 *   speedupMins + speedupKey → allocate specific then general against vaultBefore
 * Result entries include resolvedCosts (with speedup split) for locking/display.
 */
export function sequentialAfford(items, baseVault = {}) {
  const list = items || [];
  const result = new Map();

  let activeIds = new Set(list.filter((i) => i.active).map((i) => i.id));

  for (let pass = 0; pass < 12; pass++) {
    const costsById = new Map();
    for (const item of list) {
      // Base costs without baked-in speedups; split is applied per vaultBefore
      let base = stripSpeedupKeys(item.costs || {});
      // If caller already put only non-speedup in costs, fine.
      // Re-add non-dynamic speedup if no speedupMins (legacy)
      if (!(item.speedupMins > 0 && item.speedupKey)) {
        base = normalizeCostMap(item.costs || {});
      }
      costsById.set(item.id, base);
    }
    let changed = false;

    for (const item of list) {
      const otherMaps = [];
      for (const id of activeIds) {
        if (id !== item.id) {
          const prev = result.get(id);
          otherMaps.push(prev?.resolvedCosts || costsById.get(id) || {});
        }
      }
      const vaultBefore = subtractCosts(baseVault, mergeCosts(otherMaps));

      let costs = { ...(costsById.get(item.id) || {}) };
      let speedupAlloc = null;
      if (item.speedupMins > 0 && item.speedupKey) {
        speedupAlloc = allocateSpeedupMinutes(
          item.speedupMins,
          item.speedupKey,
          vaultBefore
        );
        for (const [k, v] of Object.entries(speedupAlloc.costs)) {
          costs[k] = (costs[k] || 0) + v;
        }
      }

      const { canAfford, remaining } = computeAffordability(costs, vaultBefore);
      result.set(item.id, {
        canAfford,
        vaultBefore,
        remaining,
        resolvedCosts: costs,
        speedupAlloc,
      });
    }

    // Rebuild costsById from resolved for next pass consistency
    for (const item of list) {
      const r = result.get(item.id);
      if (r?.resolvedCosts) costsById.set(item.id, r.resolvedCosts);
    }

    const nextActive = new Set();
    for (const item of list) {
      if (!item.active) continue;
      if (result.get(item.id)?.canAfford) nextActive.add(item.id);
    }
    if (nextActive.size !== activeIds.size) changed = true;
    else {
      for (const id of nextActive) {
        if (!activeIds.has(id)) changed = true;
      }
    }
    activeIds = nextActive;
    if (!changed && pass > 0) break;
  }

  return result;
}

/** Sum costs of items that are active and affordable (uses resolvedCosts when present). */
export function sumActiveCosts(items, affordMap) {
  const locked = {};
  for (const item of items || []) {
    const a = affordMap?.get(item.id);
    if (!item.active || !a?.canAfford) continue;
    const src = a.resolvedCosts || item.costs || {};
    for (const [k, amt] of Object.entries(normalizeCostMap(src))) {
      locked[k] = (locked[k] || 0) + amt;
    }
  }
  return locked;
}

export function formatCostLines(costs, vault = {}) {
  const norm = normalizeCostMap(costs);
  const { remaining } = computeAffordability(norm, vault);
  const lines = [];
  for (const [key, need] of Object.entries(norm)) {
    if (!need) continue;
    const left = remaining[key] ?? 0;
    lines.push({
      key,
      need,
      left,
      deficit: left < 0,
    });
  }
  return lines;
}

export function nextLevel(levels, from, toNumeric = (x) => {
  const n = parseFloat(x);
  return isNaN(n) ? 0 : n;
}) {
  const fromN = toNumeric(from);
  for (const lvl of levels) {
    if (toNumeric(lvl) > fromN) return String(lvl);
  }
  return '';
}
