import {
	parseCost,
	formatNumber,
	parseResourceValue
} from './calc';
/**
 * remaining = vault - cost
 * canAfford = every resource remaining >= 0
 */
export function computeAffordability(costs, vault = {}) {
	const remaining = {};
	let canAfford = true;
	for (const [key, amt] of Object.entries(costs || {})) {
		if (key.startsWith('_')) continue;
		// FIX: Use parseResourceValue instead of parseCost to handle K/M/B and time formats
		const have = parseResourceValue(vault[key]);
		const need = parseCost(amt);
		const left = have - need;
		remaining[key] = left;
		if (left < 0) canAfford = false;
	}
	return {
		remaining,
		canAfford
	};
}
export function formatCostLines(costs, vault = {}) {
	const {
		remaining
	} = computeAffordability(costs, vault);
	const lines = [];
	for (const [key, amt] of Object.entries(costs || {})) {
		if (key.startsWith('_') || !amt) continue;
		const left = remaining[key] ?? 0;
		lines.push({
			key,
			need: amt,
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
