/**
 * Image paths match original site structure under /assets/
 * Place files in: client/public/assets/
 */
const RESOURCE_IMG = {
	bread: 'Bread.webp',
	wood: 'Wood.webp',
	stone: 'Stone.webp',
	iron: 'Iron.webp',
	gold: 'Gold.webp',
	gems: 'Gem.webp',
	truegold: 'truegold.webp',
	truegold_dust: 'truegold_dust.webp',
	tempered_truegold: 'tempered_truegold.webp',
	hero_xp: 'hero_xp.webp',
	stamina: 'stamina.webp',
	master_manuscript: 'master_manuscript.webp',
	general_emblem: 'general_emblem.webp',
	elite_spices: 'Elite_Spices.webp',
	silver_goblet: 'Silver_Goblet.webp',
	copper_horn: 'Copper_Horn.webp',
	promotion_medallion: 'promotion_medallion.webp',
	nutrient_potion: 'nutrient_potion.webp',
	growth_manual: 'growth_manual.webp',
	advanced_taming_mark: 'advanced_taming_mark.webp',
	common_taming_mark: 'common_taming_mark.webp',
	pet_food: 'pet_food.webp',
	charm_design: 'charm_design.webp',
	charm_guide: 'charm_guide.webp',
	artisans_vision: 'artisans_vision.webp',
	gilded_threads: 'gilded_threads.webp',
	satin: 'satin.webp',
	mithril: 'mithril.webp',
	forge_hammer: 'forge_hammer.webp',
	mythic_general_shard: 'mythic_general_shard.webp',
	epic_general_shard: 'epic_general_shard.webp',
	rare_general_shard: 'rare_general_shard.webp',
	building_speedup: 'building_speedup.webp',
	research_speedup: 'research_speedup.webp',
	training_speedup: 'training_speedup.webp',
	master_speedup: 'master_speedup.webp',
	general_speedup: 'general_speedup.webp',
	mythic_gear: 'mythic-gear.webp',
	hero_roulette_token: 'hero_roulette_token.webp',
	widgets: 'widgets.webp',
	vault_icon: 'vault_icon.webp',
};
const BUILDING_IMG = {
	'Town Center': 'town_center.webp',
	Barracks: 'barracks.webp',
	Stable: 'stable.webp',
	Range: 'range.webp',
	'Command Center': 'command_center.webp',
	'War Academy': 'war_academy.webp',
	Embassy: 'embassy.webp',
	Academy: 'academy.webp',
	Infirmary: 'infirmary.webp',
	'Store House': 'store_house.webp',
};
const HERO_IMG = {
	Edwin: 'edwin.webp',
	Forrest: 'forrest.webp',
	Olive: 'olive.webp',
	Seth: 'seth.webp',
	Amane: 'amane.webp',
	Chenko: 'chenko.webp',
	Diana: 'diana.webp',
	Fahd: 'fahd.webp',
	Gordon: 'gordon.webp',
	Howard: 'howard.webp',
	Quinn: 'quinn.webp',
	Yeonwoo: 'yeonwoo.webp',
	Amadeus: 'amadeus.webp',
	Helga: 'helga.webp',
	Jabel: 'jabel.webp',
	Saul: 'saul.webp',
	Hilde: 'hilde.webp',
	Marlin: 'marlin.webp',
	Zoe: 'zoe.webp',
	Eric: 'eric.webp',
	Jaeger: 'jaeger.webp',
	Petra: 'petra.webp',
	Alcar: 'alcar.webp',
	Margot: 'margot.webp',
	Rosa: 'rosa.webp',
	'Long Fei': 'long_fei.webp',
	Thrud: 'thrud.webp',
	Vivian: 'vivian.webp',
	Sophia: 'sophia.webp',
	Triton: 'triton.webp',
	Yang: 'yang.webp',
	Ava: 'ava.webp',
	Charles: 'charles.webp',
	'Wee & Woo': 'wee_woo.webp',
};
const TROOP_IMG = {
	Infantry: 'Infantry.webp',
	Cavalry: 'Cavalry.webp',
	Archer: 'Archer.webp',
};
/** Base path – files live in client/public/assets */
export const asset = (path) => {
	if (!path) return '';
	const clean = String(path).replace(/^\/+/, '').replace(/^assets\//, '');
	return `/assets/${clean}`;
};
export const resourceImg = (id) => {
	const key = String(id || '');
	// Per-master emblems: use that master's avatar (not general emblem art)
	if (key.startsWith('master_emblem_')) {
		const masterId = key.slice('master_emblem_'.length);
		return masterImg(masterId);
	}
	return asset(RESOURCE_IMG[key] || `${key}.webp`);
};

/** Alternate filenames under /assets for a resource id */
export function resourceImgFallbacks(id) {
	const key = String(id || '');
	if (key.startsWith('master_emblem_')) {
		const masterId = key.slice('master_emblem_'.length);
		return masterImgFallbacks(masterId);
	}
	const primary = RESOURCE_IMG[key];
	const alts = {
		elite_spices: [
			'Elite_Spices.webp', 'elite_spices.webp', 'EliteSpices.webp', 'elite-spices.webp',
			'Elite_Spices.png', 'elite_spices.png', 'spices.webp', 'EliteSpices.png',
		],
		silver_goblet: [
			'Silver_Goblet.webp', 'silver_goblet.webp', 'SilverGoblet.webp', 'silver-goblet.webp',
			'Silver_Goblet.png', 'silver_goblet.png', 'goblet.webp', 'SilverGoblet.png',
		],
		copper_horn: [
			'Copper_Horn.webp', 'copper_horn.webp', 'CopperHorn.webp', 'copper-horn.webp',
			'Copper_Horn.png', 'copper_horn.png', 'horn.webp', 'CopperHorn.png',
		],
		general_emblem: [
			'general_emblem.webp', 'General_Emblem.webp', 'Master_Emblem.webp', 'master_emblem.webp',
			'general_emblem.png', 'GeneralEmblem.webp',
		],
		master_manuscript: [
			'master_manuscript.webp', 'Master_Manuscript.webp', 'Masters_Manuscript.webp',
			'master_manuscript.png', 'MasterManuscript.webp',
		],
		master_speedup: [
			'master_speedup.webp', 'Master_Speedup.webp', 'master_speedup.png', 'MasterSpeedup.webp',
		],
	};
	const list = [];
	if (primary) list.push(asset(primary));
	for (const name of alts[key] || []) {
		list.push(asset(name));
	}
	// generic snake + Title_Case
	if (key) {
		list.push(asset(`${key}.webp`));
		list.push(asset(`${key}.png`));
		const title = key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
		list.push(asset(`${title}.webp`));
		list.push(asset(`${title}.png`));
	}
	return [...new Set(list.filter(Boolean))];
}


/** Masters icons — place under client/public/assets/masters/ */
function slugifyMasterPart(s) {
	return String(s || '')
		.toLowerCase()
		.trim()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Master avatar: assets/masters/master-{id}-avatar.webp
 * Also tries .png and root-level fallbacks.
 */
export function masterImg(idOrName) {
	const id = slugifyMasterPart(idOrName);
	const base = `masters/master-${id}-avatar`;
	return asset(`${base}.webp`);
}

export function masterImgFallbacks(idOrName) {
	const id = slugifyMasterPart(idOrName);
	return [
		asset(`masters/master-${id}-avatar.png`),
		asset(`masters/${id}.webp`),
		asset(`masters/${id}.png`),
		asset(`icons/master-${id}-avatar.webp`),
		asset(`icons/master-${id}-avatar.png`),
		asset(`master-${id}-avatar.webp`),
		asset(`general_emblem.webp`),
	];
}

/** Talent icon: master-{id}-talent */
export function masterTalentImg(idOrName) {
	const id = slugifyMasterPart(idOrName);
	return asset(`masters/master-${id}-talent.webp`);
}

export function masterTalentImgFallbacks(idOrName) {
	const id = slugifyMasterPart(idOrName);
	return [
		asset(`masters/master-${id}-talent.png`),
		asset(`icons/master-${id}-talent.webp`),
		asset(`icons/master-${id}-talent.png`),
		...masterImgFallbacks(idOrName),
	];
}

/** Skill icon: master-{id}-{skill-slug} */
export function masterSkillImg(idOrName, skillName) {
	const id = slugifyMasterPart(idOrName);
	const sk = slugifyMasterPart(skillName);
	return asset(`masters/master-${id}-${sk}.webp`);
}

export function masterSkillImgFallbacks(idOrName, skillName) {
	const id = slugifyMasterPart(idOrName);
	const sk = slugifyMasterPart(skillName);
	return [
		asset(`masters/master-${id}-${sk}.png`),
		asset(`icons/master-${id}-${sk}.webp`),
		asset(`icons/master-${id}-${sk}.png`),
		...masterImgFallbacks(idOrName),
	];
}

/** Affinity row icon */
export function masterAffinityImg(idOrName) {
	const id = slugifyMasterPart(idOrName);
	return asset(`masters/master-${id}-type.webp`);
}

export function masterAffinityImgFallbacks(idOrName) {
	const id = slugifyMasterPart(idOrName);
	return [
		asset(`masters/master-${id}-type.png`),
		asset(`icons/master-${id}-type.webp`),
		asset(`icons/master-${id}-type.png`),
		...masterImgFallbacks(idOrName),
	];
}

export const buildingImg = (name) => asset(`building/${BUILDING_IMG[name] || name.toLowerCase().replace(/ /g, '_') + '.webp'}`);
export const heroImg = (name) => {
	const file = HERO_IMG[name] || name.toLowerCase().replace(/ /g, '_') + '.webp';
	return asset(`heroes/${file}`);
};
export const heroWidgetImg = (name) => {
	const file = (HERO_IMG[name] || name.toLowerCase().replace(/ /g, '_') + '.webp').replace('.webp', '_widget.webp');
	// original uses assets/widget/amadeus_widget.webp
	const map = {
		Amadeus: 'amadeus_widget.webp',
		Helga: 'helga_widget.webp',
		Jabel: 'jabel_widget.webp',
		Saul: 'saul_widget.webp',
		Hilde: 'hilde_widget.webp',
		Marlin: 'marlin_widget.webp',
		Zoe: 'zoe_widget.webp',
		Eric: 'eric_widget.webp',
		Jaeger: 'jaeger_widget.webp',
		Petra: 'petra_widget.webp',
		Alcar: 'alcar_widget.webp',
		Margot: 'margot_widget.webp',
		Rosa: 'rosa_widget.webp',
		'Long Fei': 'long_fei_widget.webp',
		Thrud: 'thrud_widget.webp',
		Vivian: 'vivian_widget.webp',
		Sophia: 'sophia_widget.webp',
		Triton: 'triton_widget.webp',
		Yang: 'yang_widget.webp',
		Ava: 'ava_widget.webp',
		Charles: 'charles_widget.webp',
		'Wee & Woo': 'wee_woo_widget.webp',
	};
	return asset(`widget/${map[name] || file}`);
};

function heroSlug(name) {
	return String(name || '').toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
/** Alternate paths so missing widget files still resolve when possible */
export function heroWidgetFallbacks(name) {
	const slug = heroSlug(name);
	const primary = heroWidgetImg(name);
	return [
		primary,
		asset(`widget/${slug}_widget.webp`),
		asset(`widgets/${slug}_widget.webp`),
		asset(`widget/${slug}.webp`),
		heroImg(name),
		asset(`heroes/${slug}.webp`),
		resourceImg('widgets'),
	];
}
export const troopImg = (type) => {
	let base = type;
	if (type.includes('Infantry')) base = 'Infantry';
	else if (type.includes('Cavalry')) base = 'Cavalry';
	else if (type.includes('Archer')) base = 'Archer';
	return asset(TROOP_IMG[base] || 'Infantry.webp');
};
export const petImg = (name) => asset(`pet/${name.toLowerCase().replace(/ /g, '_')}.webp`);
export const warAcademyImg = (name) => asset(`war_academy/${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}.webp`);
/** Gov Gear piece → file prefix (matches GovGearPage) */
const GEAR_PREFIX = {
	Helmet: 'cavalry_gear_1',
	Watch: 'cavalry_gear_2',
	Armor: 'infantry_gear_1',
	Pant: 'infantry_gear_2',
	Belt: 'archery_gear_1',
	Weapon: 'archery_gear_2',
};
/** Level-aware gov gear portrait, e.g. Purple⭐ → purple_t0_s1 */
export function govGearImg(piece, levelName) {
	const prefix = GEAR_PREFIX[piece] || 'cavalry_gear_1';
	let color = 'green';
	let tier = '0';
	let stars = '0';
	if (levelName && String(levelName).trim() && String(levelName) !== '0') {
		const s = String(levelName);
		const lower = s.toLowerCase();
		if (lower.includes('green')) color = 'green';
		else if (lower.includes('blue')) color = 'blue';
		else if (lower.includes('purple')) color = 'purple';
		else if (lower.includes('gold')) color = 'gold';
		else if (lower.includes('red')) color = 'red';
		const tm = s.match(/T([0-9])/i);
		if (tm) tier = tm[1];
		stars = String((s.match(/⭐/g) || []).length);
	}
	return asset(`gov_gears/${prefix}_${color}_t${tier}_s${stars}.webp`);
}
/** Charm slot type from name "Helmet Charm #1" → Helmet */
export function charmTypeFromName(name) {
	const m = String(name || '').match(/^(Helmet|Watch|Armor|Pant|Belt|Weapon)/i);
	if (!m) return 'Helmet';
	const x = m[1].toLowerCase();
	return x.charAt(0).toUpperCase() + x.slice(1);
}
/** Normalize Helmet/Watch/... casing */
function normalizeCharmType(type) {
	const map = {
		helmet: 'Helmet',
		watch: 'Watch',
		armor: 'Armor',
		pant: 'Pant',
		belt: 'Belt',
		weapon: 'Weapon',
	};
	const k = String(type || '').toLowerCase();
	return map[k] || type || 'Helmet';
}
/** Level-aware gov charm image (matches GovCharmPage) */
export function govCharmImg(typeOrName, levelName) {
	const typeMap = {
		Helmet: 'cavalry',
		Watch: 'cavalry',
		Armor: 'infantry',
		Pant: 'infantry',
		Belt: 'archery',
		Weapon: 'archery',
	};
	let type = typeOrName;
	if (String(typeOrName || '').includes('Charm')) {
		type = charmTypeFromName(typeOrName);
	}
	type = normalizeCharmType(type);
	const folderType = typeMap[type] || 'infantry';
	let level = '1';
	if (levelName) {
		const s = String(levelName).trim();
		if (s && s !== '0') {
			const m = s.match(/Level\s*(\d+)/i) || s.match(/(\d+)/);
			if (m) level = m[1];
		}
	}
	return asset(`gov_charms/${folderType}_lvl${level}.webp`);
}
