/** Shared calculation helpers ported from original app.js / page scripts */
export function parseCost(val) {
	if (val == null || val === '') return 0;
	if (typeof val === 'number') return val;
	let str = String(val).toUpperCase().trim().replace(/,/g, '');
	// Remove spaces between number and suffix (e.g., "1.5 M" -> "1.5M")
	str = str.replace(/\s+(?=[KMB])/g, '');
	if (str.endsWith('B')) return (parseFloat(str) || 0) * 1e9;
	if (str.endsWith('M')) return (parseFloat(str) || 0) * 1e6;
	if (str.endsWith('K')) return (parseFloat(str) || 0) * 1e3;
	return parseFloat(str) || 0;
}
export function parseTimeToSeconds(timeStr) {
	if (timeStr == null || timeStr === '') return 0;
	if (typeof timeStr === 'number') return timeStr;
	const s = String(timeStr).toUpperCase().trim();
	if (!s) return 0;
	// If it's just a number (no time units), assume it's seconds
	if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
	let sec = 0;
	const d = s.match(/(\d+)\s*D/);
	const h = s.match(/(\d+)\s*H/);
	const m = s.match(/(\d+)\s*M(?!S)/);
	const secM = s.match(/(\d+)\s*S/);
	if (d) sec += parseInt(d[1], 10) * 86400;
	if (h) sec += parseInt(h[1], 10) * 3600;
	if (m) sec += parseInt(m[1], 10) * 60;
	if (secM) sec += parseInt(secM[1], 10);
	return sec;
}
export function parseTimeToMinutes(timeStr) {
	return Math.ceil(parseTimeToSeconds(timeStr) / 60);
}
export const SCORE_RULES = {
	truegold: 2000,
	truegold_dust: 1000,
	tempered_truegold: 30000,
	forge_hammer: 4000,
	widgets: 8000,
	mithril: 40000,
	advanced_taming_mark: 15000,
	common_taming_mark: 1150,
	general_emblem: 6000,
	master_manuscript: 60,
	speedup_min: 30,
	roulette: 8000,
	rare_general_shard: 350,
	epic_general_shard: 1220,
	mythic_general_shard: 3040,
	troops: {
		1: 1,
		2: 2,
		3: 3,
		4: 5,
		5: 7,
		6: 11,
		7: 16,
		8: 23,
		9: 30,
		10: 39,
		11: 49
	},
	gov_gear_score: 36,
	gov_charm_score: 70,
	satin: 1,
	gilded_threads: 1,
	artisans_vision: 1,
	charm_guide: 1,
	charm_design: 1,
	building_speedup: 30,
	training_speedup: 30,
	research_speedup: 30,
	pet_advancement_score: 50
};
export const RESOURCE_ITEMS = [{
	id: 'bread',
	placeholder: '1.5M',
	label: 'Bread'
}, {
	id: 'wood',
	placeholder: '2.3M',
	label: 'Wood'
}, {
	id: 'stone',
	placeholder: '500K',
	label: 'Stone'
}, {
	id: 'iron',
	placeholder: '125K',
	label: 'Iron'
}, {
	id: 'gold',
	placeholder: '10K',
	label: 'Gold'
}, {
	id: 'gems',
	placeholder: '10000',
	label: 'Gems'
}, {
	id: 'truegold',
	placeholder: '500',
	label: 'Truegold'
}, {
	id: 'truegold_dust',
	placeholder: '1000',
	label: 'Truegold Dust'
}, {
	id: 'tempered_truegold',
	placeholder: '25',
	label: 'Tempered Truegold'
}, {
	id: 'hero_xp',
	placeholder: '1000',
	label: 'Hero XP'
}, {
	id: 'stamina',
	placeholder: '100',
	label: 'Stamina'
}, {
	id: 'master_manuscript',
	placeholder: '50',
	label: 'Master Manuscript'
}, {
	id: 'general_emblem',
	placeholder: '20',
	label: 'General Emblem'
}, {
	id: 'promotion_medallion',
	placeholder: '10',
	label: 'Promotion Medallion'
}, {
	id: 'nutrient_potion',
	placeholder: '20',
	label: 'Nutrient Potion'
}, {
	id: 'growth_manual',
	placeholder: '100',
	label: 'Growth Manual'
}, {
	id: 'advanced_taming_mark',
	placeholder: '30',
	label: 'Advanced Taming Mark'
}, {
	id: 'common_taming_mark',
	placeholder: '30',
	label: 'Common Taming Mark'
}, {
	id: 'pet_food',
	placeholder: '5000',
	label: 'Pet Food'
}, {
	id: 'charm_design',
	placeholder: '80',
	label: 'Charm Design'
}, {
	id: 'charm_guide',
	placeholder: '100',
	label: 'Charm Guide'
}, {
	id: 'artisans_vision',
	placeholder: '50',
	label: "Artisan's Vision"
}, {
	id: 'gilded_threads',
	placeholder: '200',
	label: 'Gilded Threads'
}, {
	id: 'satin',
	placeholder: '5000',
	label: 'Satin'
}, {
	id: 'mithril',
	placeholder: '10',
	label: 'Mithril'
}, {
	id: 'forge_hammer',
	placeholder: '50',
	label: 'Forge Hammer'
}, {
	id: 'mythic_general_shard',
	placeholder: '50',
	label: 'Mythic General Shard'
}, {
	id: 'epic_general_shard',
	placeholder: '200',
	label: 'Epic General Shard'
}, {
	id: 'rare_general_shard',
	placeholder: '500',
	label: 'Rare General Shard'
}, {
	id: 'building_speedup',
	placeholder: '2d 14h 35m',
	label: 'Building Speedup'
}, {
	id: 'research_speedup',
	placeholder: '5d 3h 20m',
	label: 'Research Speedup'
}, {
	id: 'training_speedup',
	placeholder: '1d 12h 5m',
	label: 'Training Speedup'
}, {
	id: 'master_speedup',
	placeholder: '1d',
	label: 'Master Speedup'
}, {
	id: 'general_speedup',
	placeholder: '10d 8h 45m',
	label: 'General Speedup'
}, {
	id: 'mythic_gear',
	placeholder: '10',
	label: 'Mythic Gear'
}, {
	id: 'hero_roulette_token',
	placeholder: '100',
	label: 'Hero Roulette Token'
}];
export function formatNumber(n) {
	if (n == null || isNaN(n)) return '0';
	const num = Number(n);
	if (Math.abs(num) >= 1e9) {
		const v = num / 1e9;
		return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)) + 'B';
	}
	if (Math.abs(num) >= 1e6) {
		const v = num / 1e6;
		return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)) + 'M';
	}
	if (Math.abs(num) >= 1e3) {
		const v = num / 1e3;
		return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)) + 'K';
	}
	return Math.round(num).toLocaleString();
}
export function formatSecondsToTime(totalSeconds) {
	if (!totalSeconds || totalSeconds <= 0) return '0s';
	const d = Math.floor(totalSeconds / 86400);
	const h = Math.floor((totalSeconds % 86400) / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = Math.floor(totalSeconds % 60);
	const parts = [];
	if (d) parts.push(`${d}d`);
	if (h) parts.push(`${h}h`);
	if (m) parts.push(`${m}m`);
	if (s && !d) parts.push(`${s}s`);
	return parts.join(' ') || '0s';
}
export function convertLevelToNumeric(level) {
	if (level === undefined || level === null || level === '') return 0;
	const levelStr = String(level).trim();
	const tgMatch = levelStr.match(/^TG(\d+)(?:-(\d+))?$/i);
	if (tgMatch) {
		const mainTg = parseInt(tgMatch[1], 10);
		const subLevel = tgMatch[2] ? parseInt(tgMatch[2], 10) : 0;
		let numericValue = 30 + (mainTg * 5);
		if (subLevel > 0) numericValue += subLevel;
		return numericValue;
	}
	const advMatch = levelStr.match(/^(\d+(?:\.\d+)?)[_ ]?Advancement$/i);
	if (advMatch) return parseFloat(advMatch[1]) + 0.5;
	const num = parseFloat(levelStr);
	if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(levelStr)) return num;
	const m = levelStr.match(/(\d+(?:\.\d+)?)/);
	return m ? parseFloat(m[1]) : 0;
}
export function sortLevels(levels) {
	return [...levels].sort((a, b) => convertLevelToNumeric(a) - convertLevelToNumeric(b));
}
export function getLevelsFromArray(arr, fields = ['level', 'current_lvl', 'current', 'target_lvl', 'target'], {
	includeZero = true,
	preserveOrder = false
} = {}) {
	const ordered = [];
	const set = new Set();
	const push = (v) => {
		const s = String(v);
		if (!set.has(s)) {
			set.add(s);
			ordered.push(s);
		}
	};
	if (includeZero) push('0');
	for (const item of arr || []) {
		for (const f of fields) {
			if (item[f] !== undefined && item[f] !== null && item[f] !== '') {
				push(item[f]);
			}
		}
	}
	if (preserveOrder) return ordered;
	return ordered.sort((a, b) => {
		const na = convertLevelToNumeric(a);
		const nb = convertLevelToNumeric(b);
		if (na !== nb) return na - nb;
		return String(a).localeCompare(String(b));
	});
}
export function getUpgradeSteps(dataArray, fromLevel, toLevel) {
	const steps = [];
	const fromStr = String(fromLevel);
	const toStr = String(toLevel);
	if (fromStr === '0' || fromStr === '') {
		for (const item of dataArray || []) {
			const lvl = item.level ?? item.target_lvl ?? item.target;
			if (lvl !== undefined) {
				steps.push(item);
				if (String(lvl) === toStr) break;
			}
		}
		return steps;
	}
	let start = -1;
	let end = -1;
	for (let i = 0; i < (dataArray || []).length; i++) {
		const lvl = dataArray[i].level ?? dataArray[i].target_lvl ?? dataArray[i].target;
		if (lvl !== undefined && String(lvl) === fromStr) start = i;
		if (lvl !== undefined && String(lvl) === toStr) end = i;
	}
	if (start !== -1 && end !== -1 && start < end) {
		for (let i = start + 1; i <= end; i++) steps.push(dataArray[i]);
		return steps;
	}
	let current = fromStr;
	const visited = new Set();
	for (let safety = 0; safety < 300; safety++) {
		if (visited.has(current)) break;
		visited.add(current);
		let found = false;
		for (const item of dataArray || []) {
			const prev = item.current_lvl ?? item.current;
			const next = item.level ?? item.target_lvl ?? item.target;
			if (prev !== undefined && String(prev) === current) {
				steps.push(item);
				current = String(next);
				found = true;
				if (current === toStr) return steps;
				break;
			}
		}
		if (!found) break;
	}
	return steps;
}
export function calcVaultScore(vault) {
	let total = 0;
	const speedupKeys = ['building_speedup', 'research_speedup', 'training_speedup', 'master_speedup', 'general_speedup'];
	for (const [key, raw] of Object.entries(vault || {})) {
		const val = parseResourceValue(String(raw ?? ''));
		if (!val) continue;
		if (speedupKeys.includes(key)) total += val * SCORE_RULES.speedup_min;
		else if (SCORE_RULES[key] != null) total += val * SCORE_RULES[key];
	}
	return Math.round(total);
}
export function parseResourceValue(str) {
	if (str == null || str === '') return 0;
	if (typeof str === 'number') return str;
	const s = String(str).trim();
	if (!s) return 0;
	// Check if it's a time format (contains d, h, m, s)
	if (/[dhms]/i.test(s)) {
		return parseTimeToMinutes(s);
	}
	// Check if it's a number with K/M/B suffix
	const upper = s.toUpperCase().trim();
	// Remove spaces between number and suffix (e.g., "1.5 M" -> "1.5M")
	const cleaned = upper.replace(/\s+(?=[KMB])/g, '');
	// Handle K, M, B suffix
	if (/[KMB]$/.test(cleaned)) {
		const numStr = cleaned.slice(0, -1);
		const num = parseFloat(numStr);
		if (isNaN(num)) return 0;
		const suffix = cleaned.slice(-1);
		if (suffix === 'K') return num * 1000;
		if (suffix === 'M') return num * 1000000;
		if (suffix === 'B') return num * 1000000000;
	}
	// Check if it's a plain number (with commas)
	const num = parseFloat(s.replace(/,/g, ''));
	if (!isNaN(num)) return num;
	return 0;
}
export function applyBuildingSpeedupBuffs(originalSeconds, buffs = {}) {
	if (!originalSeconds || originalSeconds <= 0) return 0;
	let remaining = originalSeconds;
	const totalPercent = (parseFloat(buffs.buildingPct) || 0) + (parseFloat(buffs.wolfPet) || 0) + (parseFloat(buffs.kingPos) || 0) + (buffs.groundWorks ? 10 : 0);
	if (totalPercent > 0) remaining = remaining / (1 + totalPercent / 100);
	if (buffs.pansArtifact) {
		const pansSec = parseTimeToSeconds(String(buffs.pansArtifact));
		remaining = Math.max(0, remaining - pansSec);
	}
	if (buffs.doubleTime) remaining = remaining / 1.2;
	return Math.max(1, Math.ceil(remaining));
}
export function applyTrainingSpeedupBuffs(originalSeconds, buffs = {}) {
	if (!originalSeconds || originalSeconds <= 0) return 0;
	let remaining = originalSeconds;
	const totalPercent = (parseFloat(buffs.trainingPct) || 0) + (parseFloat(buffs.kingPos) || 0) + (buffs.mobilize ? 30 : 0) + (buffs.kvk ? 25 : 0);
	if (totalPercent > 0) remaining = remaining / (1 + totalPercent / 100);
	return Math.max(1, Math.ceil(remaining));
}
export function applyResearchSpeedupBuffs(originalSeconds, buffs = {}) {
	if (!originalSeconds || originalSeconds <= 0) return 0;
	let remaining = originalSeconds;
	const totalPercent = (parseFloat(buffs.researchPct) || 0) + (parseFloat(buffs.kingPos) || 0) + (buffs.freshIdeas ? 10 : 0);
	if (totalPercent > 0) remaining = remaining / (1 + totalPercent / 100);
	return Math.max(1, Math.ceil(remaining));
}
export function secondsToSpeedupMinutes(sec) {
	return Math.ceil((sec || 0) / 60);
}
export function getAvailableSpeedups(vault, type) {
	const training = parseResourceValue(vault?.training_speedup);
	const general = parseResourceValue(vault?.general_speedup);
	if (type === 'building') {
		return parseResourceValue(vault?.building_speedup);
	}
	if (type === 'research') {
		return parseResourceValue(vault?.research_speedup);
	}
	if (type === 'training') {
		return training + general;
	}
	return 0;
}
export function calculateSpeedupUsage(totalTimeSeconds, vault, type, otherLocked = {}) {
	if (totalTimeSeconds <= 0) {
		return {
			usedSpeedup: 0,
			totalUsed: 0,
			totalPoints: 0,
			partialNote: ''
		};
	}
	const buffedTimeSeconds = totalTimeSeconds;
	const totalSpeedupMinutesNeeded = secondsToSpeedupMinutes(buffedTimeSeconds);
	if (type === 'building') {
		const available = Math.max(0, parseResourceValue(vault?.building_speedup) - parseResourceValue(otherLocked?.building_speedup));
		const used = Math.min(available, totalSpeedupMinutesNeeded);
		const remaining = totalSpeedupMinutesNeeded - used;
		const partialNote = remaining > 0 ? `Only ${formatSecondsToTime(used * 60)} available (need ${formatSecondsToTime(totalSpeedupMinutesNeeded * 60)})` : '';
		return {
			usedSpeedup: used,
			totalUsed: used,
			totalPoints: used * SCORE_RULES.speedup_min,
			partialNote
		};
	}
	if (type === 'research') {
		const available = Math.max(0, parseResourceValue(vault?.research_speedup) - parseResourceValue(otherLocked?.research_speedup));
		const used = Math.min(available, totalSpeedupMinutesNeeded);
		const remaining = totalSpeedupMinutesNeeded - used;
		const partialNote = remaining > 0 ? `Only ${formatSecondsToTime(used * 60)} available (need ${formatSecondsToTime(totalSpeedupMinutesNeeded * 60)})` : '';
		return {
			usedSpeedup: used,
			totalUsed: used,
			totalPoints: used * SCORE_RULES.speedup_min,
			partialNote
		};
	}
	if (type === 'training') {
		const trainingAvailable = Math.max(0, parseResourceValue(vault?.training_speedup) - parseResourceValue(otherLocked?.training_speedup));
		const generalAvailable = Math.max(0, parseResourceValue(vault?.general_speedup) - parseResourceValue(otherLocked?.general_speedup));
		let remaining = totalSpeedupMinutesNeeded;
		let usedTraining = 0;
		let usedGeneral = 0;
		if (trainingAvailable > 0) {
			usedTraining = Math.min(trainingAvailable, remaining);
			remaining -= usedTraining;
		}
		if (remaining > 0 && generalAvailable > 0) {
			usedGeneral = Math.min(generalAvailable, remaining);
			remaining -= usedGeneral;
		}
		const totalUsed = usedTraining + usedGeneral;
		const totalPoints = totalUsed * SCORE_RULES.speedup_min;
		const partialNote = remaining > 0 ? `Only ${formatSecondsToTime(totalUsed * 60)} available (need ${formatSecondsToTime(totalSpeedupMinutesNeeded * 60)})` : '';
		return {
			usedTraining,
			usedGeneral,
			totalUsed,
			totalPoints,
			partialNote
		};
	}
	return {
		usedSpeedup: 0,
		totalUsed: 0,
		totalPoints: 0,
		partialNote: ''
	};
}
