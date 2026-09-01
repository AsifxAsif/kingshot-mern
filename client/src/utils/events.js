/**
 * Multi-event scoring (from Points.json: ab / kvk / sg).
 * Active event is stored in settings.activeEvent and drives all calculators.
 */
export const EVENT_IDS = ['sg', 'kvk', 'ab'];
export const EVENTS = {
	sg: {
		id: 'sg',
		name: 'Strongest Governor',
		short: 'SG',
		description: 'Building, research, heroes, pets, troops, gear — main growth event.',
		accent: '#5b8def',
	},
	kvk: {
		id: 'kvk',
		name: 'Kingdom vs Kingdom',
		short: 'KvK',
		description: 'Similar growth scoring to SG with KvK point values; intel missions score.',
		accent: '#e07a5f',
	},
	ab: {
		id: 'ab',
		name: 'Alliance Brawl',
		short: 'AB',
		description: 'Alliance Brawl point values; includes gems, trucks, beasts, terror, top-up.',
		accent: '#81b29a',
	},
};
/** Per-resource / action points by event (aligned with Points.json). */
export const EVENT_SCORE_TABLES = {
	sg: {
		truegold: 2000,
		truegold_dust: 1000,
		tempered_truegold: 30000,
		forge_hammer: 4000,
		forgehammer: 4000,
		widgets: 8000,
		mithril: 40000,
		hero_xp: 0,
		xp: 0,
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
		pet_advancement: 50,
		satin: 1,
		gilded_threads: 1,
		artisans_vision: 1,
		charm_guide: 1,
		charm_design: 1,
		building_speedup: 30,
		training_speedup: 30,
		research_speedup: 30,
		gather_bread_wood_per: 2500,
		gather_bread_wood_pts: 3,
		gather_stone_per: 500,
		gather_stone_pts: 3,
		gather_iron_per: 100,
		gather_iron_pts: 3,
		gem: 0,
		topup_point: 0,
		escort_truck: 0,
		raid_truck: 0,
		intel_mission: 0,
		beast_1_10: 0,
		beast_11_15: 0,
		beast_16_20: 0,
		beast_21_25: 0,
		beast_26_30: 0,
		terror_rally: 0,
	},
	kvk: {
		truegold: 2000,
		truegold_dust: 1000,
		tempered_truegold: 30000,
		forge_hammer: 4000,
		forgehammer: 4000,
		widgets: 8000,
		mithril: 40000,
		hero_xp: 0,
		xp: 0,
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
			1: 3,
			2: 4,
			3: 5,
			4: 8,
			5: 12,
			6: 18,
			7: 25,
			8: 35,
			9: 45,
			10: 60,
			11: 75
		},
		gov_gear_score: 36,
		gov_charm_score: 70,
		pet_advancement: 50,
		satin: 1,
		gilded_threads: 1,
		artisans_vision: 1,
		charm_guide: 1,
		charm_design: 1,
		building_speedup: 30,
		training_speedup: 30,
		research_speedup: 30,
		gather_bread_wood_per: 1000,
		gather_bread_wood_pts: 2,
		gather_stone_per: 200,
		gather_stone_pts: 2,
		gather_iron_per: 50,
		gather_iron_pts: 2,
		gem: 0,
		topup_point: 0,
		escort_truck: 0,
		raid_truck: 0,
		intel_mission: 6000,
		beast_1_10: 0,
		beast_11_15: 0,
		beast_16_20: 0,
		beast_21_25: 0,
		beast_26_30: 0,
		terror_rally: 0,
	},
	ab: {
		truegold: 1250,
		truegold_dust: 625,
		tempered_truegold: 0,
		forge_hammer: 1875,
		forgehammer: 1875,
		widgets: 3750,
		mithril: 18750,
		hero_xp: 0,
		xp: 0,
		advanced_taming_mark: 9370,
		common_taming_mark: 680,
		general_emblem: 3600,
		master_manuscript: 36,
		speedup_min: 18,
		roulette: 0,
		rare_general_shard: 210,
		epic_general_shard: 750,
		mythic_general_shard: 1875,
		troops: {
			1: 1,
			2: 1,
			3: 2,
			4: 3,
			5: 4,
			6: 7,
			7: 10,
			8: 14,
			9: 18,
			10: 24,
			11: 30
		},
		gov_gear_score: 22,
		gov_charm_score: 45,
		pet_advancement: 30,
		satin: 1,
		gilded_threads: 1,
		artisans_vision: 1,
		charm_guide: 1,
		charm_design: 1,
		building_speedup: 18,
		training_speedup: 18,
		research_speedup: 18,
		gather_bread_wood_per: 2000,
		gather_bread_wood_pts: 2,
		gather_stone_per: 400,
		gather_stone_pts: 2,
		gather_iron_per: 100,
		gather_iron_pts: 2,
		gem: 1,
		topup_point: 6,
		escort_truck: 10000,
		raid_truck: 10000,
		intel_mission: 3000,
		beast_1_10: 4000,
		beast_11_15: 4500,
		beast_16_20: 5000,
		beast_21_25: 5500,
		beast_26_30: 6000,
		terror_rally: 15000,
	},
};
export function normalizeEventId(id) {
	if (id == null || id === '') return null;
	const k = String(id).toLowerCase();
	return EVENT_IDS.includes(k) ? k : null;
}
export function getScoreRules(eventId = 'sg') {
	const id = normalizeEventId(eventId) || 'sg';
	const base = EVENT_SCORE_TABLES[id] || EVENT_SCORE_TABLES.sg;
	// Fresh object every call so React hook deps always see a change when event changes
	return {
		...base,
		troops: {
			...(base.troops || {})
		},
		_eventId: id,
	};
}
/** Common vault fields for every event (ids match RESOURCE_ITEMS / vault keys) */
export const VAULT_COMMON_IDS = ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold', 'truegold_dust', 'tempered_truegold', 'hero_xp', 'stamina', 'master_manuscript', 'general_emblem', 'promotion_medallion', 'nutrient_potion', 'growth_manual', 'advanced_taming_mark', 'common_taming_mark', 'pet_food', 'charm_design', 'charm_guide', 'mithril', 'forge_hammer', 'widgets', 'building_speedup', 'research_speedup', 'training_speedup', 'master_speedup', 'general_speedup', 'rare_general_shard', 'epic_general_shard', 'mythic_general_shard', 'hero_roulette_token', ];
/** Extra vault / misc inputs by event */
export const VAULT_EVENT_EXTRA = {
	sg: [],
	kvk: [{
		id: 'intel_missions',
		label: 'Intel Missions completed',
		placeholder: '0',
		misc: true
	}, ],
	ab: [
		// gems already in common RESOURCE_ITEMS; scored on Misc via SCORE_RULES.gem
		{
			id: 'topup_points',
			label: 'Top-up points obtained',
			placeholder: '0',
			misc: true
		}, {
			id: 'escort_trucks',
			label: 'Escort Truck runs',
			placeholder: '0',
			misc: true
		}, {
			id: 'raid_trucks',
			label: 'Raid Truck runs',
			placeholder: '0',
			misc: true
		}, {
			id: 'intel_missions',
			label: 'Intel Missions completed',
			placeholder: '0',
			misc: true
		}, {
			id: 'beast_1_10',
			label: 'Beasts Lv1–10 defeated',
			placeholder: '0',
			misc: true
		}, {
			id: 'beast_11_15',
			label: 'Beasts Lv11–15 defeated',
			placeholder: '0',
			misc: true
		}, {
			id: 'beast_16_20',
			label: 'Beasts Lv16–20 defeated',
			placeholder: '0',
			misc: true
		}, {
			id: 'beast_21_25',
			label: 'Beasts Lv21–25 defeated',
			placeholder: '0',
			misc: true
		}, {
			id: 'beast_26_30',
			label: 'Beasts Lv26–30 defeated',
			placeholder: '0',
			misc: true
		}, {
			id: 'terror_rallies',
			label: 'Terror rallies completed',
			placeholder: '0',
			misc: true
		},
	],
};
/**
 * Gather rate helper for active event.
 * Returns { rate (pts), per (resource amount) } for a resource type.
 */
export function getGatherRate(eventId, resourceType) {
	const rules = getScoreRules(eventId);
	const t = String(resourceType || '').toLowerCase();
	if (t === 'bread' || t === 'wood') {
		return {
			rate: rules.gather_bread_wood_pts || 3,
			per: rules.gather_bread_wood_per || 2500
		};
	}
	if (t === 'stone') {
		return {
			rate: rules.gather_stone_pts || 3,
			per: rules.gather_stone_per || 500
		};
	}
	if (t === 'iron') {
		return {
			rate: rules.gather_iron_pts || 3,
			per: rules.gather_iron_per || 100
		};
	}
	return {
		rate: 3,
		per: 2500
	};
}
