/**
 * Prerequisite checks for Buildings & War Academy upgrades.
 *
 * Requirement string formats in JSON:
 *   "Town Center Lv. 6"
 *   "Embassy Lv. TG2"
 *   "War Academy TG1"          → War Academy building at TG1
 *   "Truegold Blades lvl4"
 *   "Truegold Blades LVL6"
 *   "Hero Hall Lv. 1"          → external (not tracked on this site)
 */

import { convertLevelToNumeric } from './calc';

/** Known building names from Buildings.json (exact keys) */
export const TRACKED_BUILDINGS = new Set([
  'Town Center',
  'Barracks',
  'Stable',
  'Range',
  'Command Center',
  'War Academy',
  'Embassy',
  'Infirmary',
]);

/**
 * Parse one requirement string → { kind, name, level, raw, tracked }
 * kind: 'building' | 'tech' | 'unknown'
 *
 * IMPORTANT: match "… lvlN" tech patterns BEFORE "… Lv. N" building patterns.
 * Otherwise "Truegold Battalion (Archer) lvl5" is misread as building "… Lv" + "l5"
 * (case-insensitive Lv matches the start of "lvl") and marked not tracked.
 */
export function parseRequirement(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  // War Academy TG1 / War Academy TG2 (building truegold tier)
  let m = s.match(/^War\s*Academy\s+TG(\d+)$/i);
  if (m) {
    return {
      kind: 'building',
      name: 'War Academy',
      level: `TG${m[1]}`,
      raw: s,
      tracked: true,
    };
  }

  // Tech FIRST: "Truegold Blades lvl4" / "Truegold Blades LVL6" / "… lvl 5"
  // Require the letters "lvl" as a whole token (not building "Lv.")
  m = s.match(/^(.+?)\s+lvl\.?\s*(\d+)$/i);
  if (m) {
    return {
      kind: 'tech',
      name: m[1].trim(),
      level: String(m[2]),
      raw: s,
      tracked: true,
    };
  }

  // Building: "Name Lv. X" or "Name Lv. TG2"
  // Require "Lv" then optional "." then space or TG/digit — avoid matching "lvl…"
  m = s.match(/^(.+?)\s+Lv\.?\s+(TG\d+(?:-\d+)?|\d+)$/i);
  if (m) {
    const name = m[1].trim();
    const level = m[2].trim();
    const tracked = TRACKED_BUILDINGS.has(name);
    return {
      kind: 'building',
      name,
      level,
      raw: s,
      tracked,
    };
  }

  // Fallback building without space after Lv. e.g. "Embassy Lv.30"
  m = s.match(/^(.+?)\s+Lv\.?(TG\d+(?:-\d+)?|\d+)$/i);
  if (m) {
    const name = m[1].trim();
    const level = m[2].trim();
    // Reject if this was actually "…lvl5" already handled above
    const tracked = TRACKED_BUILDINGS.has(name);
    return {
      kind: 'building',
      name,
      level,
      raw: s,
      tracked,
    };
  }

  return {
    kind: 'unknown',
    name: s,
    level: null,
    raw: s,
    tracked: false,
  };
}

/**
 * Find tech entry in warAcademy state (exact, then case-insensitive).
 */
function findTechEntry(warAcademyState, name) {
  if (!warAcademyState || !name) return null;
  if (warAcademyState[name]) return warAcademyState[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(warAcademyState)) {
    if (key.toLowerCase() === lower) return warAcademyState[key];
  }
  return null;
}

/**
 * Effective level for prerequisite checks = selected **current** level only (`from`).
 */
export function effectiveLevel(entry) {
  if (!entry) return '0';
  return String(entry.from ?? entry.level ?? '0');
}

/**
 * Does currentLevel meet requiredLevel? (numeric / TG aware)
 */
export function levelMeets(currentLevel, requiredLevel) {
  return convertLevelToNumeric(currentLevel) >= convertLevelToNumeric(requiredLevel);
}

/**
 * True if this requirement refers to the same research/building being upgraded.
 * Intermediate self-levels are completed automatically along the from→to path.
 */
function isSelfRequirement(parsed, selfName) {
  if (!selfName || !parsed?.name) return false;
  const a = String(parsed.name).trim().toLowerCase();
  const b = String(selfName).trim().toLowerCase();
  if (a === b) return true;
  // "Truegold Bows" vs "Truegold Bows" already covered; also strip type suffix mismatch edge cases
  const strip = (s) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return strip(a) === strip(b) && a.includes('(') === b.includes('(');
}

/**
 * Collect requirements from upgrade steps (from→to path), then collapse to
 * **ultimate level only** per dependency name.
 *
 * @param {Array} steps - cost rows between from and to
 * @param {string} [selfName] - name of the tech/building being upgraded; its own
 *   intermediate level requirements are omitted (completed automatically on the path)
 *
 * Example path Bracers 1→4 may list Bracers lvl2/3 — those are dropped.
 * War Academy TG2 + Battalion lvl4 are kept at their max only.
 */
export function collectStepRequirements(steps, selfName = '') {
  // key = kind|name (case-insensitive name) → best parsed req
  const best = new Map();

  for (const step of steps || []) {
    const reqs = step.requirements || step.requirement || [];
    const arr = Array.isArray(reqs) ? reqs : [reqs];
    for (const r of arr) {
      if (r == null || r === '') continue;
      const parsed = parseRequirement(String(r));
      if (!parsed) continue;
      if (isSelfRequirement(parsed, selfName)) continue;

      const nameKey = String(parsed.name || parsed.raw || '').toLowerCase();
      const mapKey = `${parsed.kind}|${nameKey}`;
      const prev = best.get(mapKey);

      if (!prev) {
        best.set(mapKey, parsed);
        continue;
      }

      // Keep the higher required level (numeric / TG aware)
      if (
        parsed.level != null &&
        convertLevelToNumeric(parsed.level) > convertLevelToNumeric(prev.level)
      ) {
        best.set(mapKey, parsed);
      }
    }
  }

  // Rebuild display strings for evaluateRequirements
  const list = [];
  for (const parsed of best.values()) {
    if (parsed.kind === 'building' && parsed.name === 'War Academy' && parsed.level) {
      list.push(`War Academy ${parsed.level}`);
    } else if (parsed.kind === 'tech' && parsed.name && parsed.level != null) {
      list.push(`${parsed.name} lvl${parsed.level}`);
    } else if (parsed.kind === 'building' && parsed.name && parsed.level != null) {
      list.push(`${parsed.name} Lv. ${parsed.level}`);
    } else if (parsed.raw) {
      list.push(parsed.raw);
    }
  }
  return list;
}

/**
 * Evaluate requirements against building + war-academy state maps.
 *
 * buildingsState: { [name]: { from, to, active } }
 * warAcademyState: { [techName]: { from, to, active } }
 *
 * Returns { allMet, items: [{ raw, name, level, kind, tracked, met, have }] }
 */
export function evaluateRequirements(rawList, buildingsState = {}, warAcademyState = {}) {
  const items = [];
  let allMet = true;

  for (const raw of rawList || []) {
    let parsed = parseRequirement(raw);
    if (!parsed) continue;

    // If misclassified, but name matches a WA tech in state, treat as tech
    if (parsed.kind === 'building' && !parsed.tracked) {
      const techHit = findTechEntry(warAcademyState, parsed.name);
      if (techHit) {
        parsed = { ...parsed, kind: 'tech', tracked: true };
      }
    }

    let have = '0';
    let met = true;

    if (parsed.kind === 'building') {
      if (parsed.tracked) {
        have = effectiveLevel(buildingsState[parsed.name]);
        met = levelMeets(have, parsed.level);
      } else {
        have = null;
        met = true; // external — do not block
      }
    } else if (parsed.kind === 'tech') {
      const tech = findTechEntry(warAcademyState, parsed.name);
      // Even if never opened the card, current is 0 unless user set it
      have = effectiveLevel(tech);
      met = levelMeets(have, parsed.level);
      parsed = { ...parsed, tracked: true };
    } else {
      met = true;
      have = null;
    }

    if (parsed.tracked && !met) allMet = false;

    items.push({
      ...parsed,
      have,
      met,
    });
  }

  return { allMet, items };
}
