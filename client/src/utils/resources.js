import { parseCost, formatNumber, parseResourceValue } from './calc';

/**
 * remaining = vault - cost
 * canAfford = every resource remaining >= 0
 */
export function computeAffordability(costs, vault = {}) {
  const remaining = {};
  let canAfford = true;
  for (const [key, amt] of Object.entries(costs || {})) {
    if (key.startsWith('_')) continue;
    // Parse vault value using parseResourceValue to handle K/M/B and time formats
    const have = parseResourceValue(vault[key]);
    const need = parseCost(amt);
    const left = have - need;
    remaining[key] = left;
    if (left < 0) canAfford = false;
  }
  return { remaining, canAfford };
}

export function formatCostLines(costs, vault = {}) {
  const { remaining } = computeAffordability(costs, vault);
  const lines = [];
  for (const [key, amt] of Object.entries(costs || {})) {
    if (key.startsWith('_') || !amt) continue;
    const left = remaining[key] ?? 0;
    const isSpeedup = key.includes('speedup');
    const displayNeed = isSpeedup ? formatTimeValue(need) : formatNumber(need);
    const displayLeft = isSpeedup ? formatTimeValue(left) : formatNumber(left);
    lines.push({
      key,
      need: amt,
      left,
      deficit: left < 0,
      displayNeed,
      displayLeft,
    });
  }
  return lines;
}

// Helper to format time values
function formatTimeValue(minutes) {
  if (minutes <= 0) return '0';
  const seconds = minutes * 60;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || '0m';
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