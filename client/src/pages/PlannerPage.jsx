import { useMemo, useCallback } from 'react';
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
import { buildingImg, warAcademyImg, asset } from '../utils/images';

/** Fixed Strongest Governor 7-day schedule */
export const EVENT_DAYS = [
  {
    day: 1,
    title: 'City Construction',
    categories: ['buildings', 'warAcademy', 'govCharm', 'speedups'],
    sources: [
      'Construction / Research / Training speedups',
      'Truegold & Tempered Truegold (buildings)',
      'Truegold Dust (research)',
      'Governor Charm',
    ],
  },
  {
    day: 2,
    title: 'Hero Development',
    categories: ['heroes', 'widgets', 'heroGear', 'buildings', 'warAcademy', 'speedups', 'miscRoulette'],
    sources: [
      'Hero shards & Hero Roulette',
      'Widgets, Mithril, Forgehammer',
      'Truegold / Tempered Truegold / Truegold Dust',
      'Construction / Research / Training speedups',
    ],
  },
  {
    day: 3,
    title: 'Basic Skill Up',
    categories: ['heroes', 'pets', 'govCharm', 'miscRoulette'],
    sources: [
      'Hero shards & Hero Roulette',
      'Taming Marks & Pet advancement',
      'Governor Charm',
    ],
  },
  {
    day: 4,
    title: 'Combat Training',
    categories: ['troops', 'widgets', 'heroGear', 'govCharm'],
    sources: [
      'Troop training / promotion',
      'Widgets, Mithril, Forgehammer',
      'Governor Charm',
    ],
  },
  {
    day: 5,
    title: 'Power Boost',
    categories: ['buildings', 'warAcademy', 'widgets', 'heroGear', 'speedups'],
    sources: [
      'Truegold / Tempered Truegold / Truegold Dust',
      'Widgets, Mithril, Forgehammer',
      'Construction / Research / Training speedups',
    ],
  },
  {
    day: 6,
    title: 'Combat Training',
    categories: ['troops', 'govGear'],
    sources: ['Troop training / promotion', 'Governor Gear'],
  },
  {
    day: 7,
    title: 'Final Hero Development',
    categories: [
      'heroes',
      'pets',
      'buildings',
      'warAcademy',
      'govGear',
      'miscGather',
      'speedups',
    ],
    sources: [
      'Hero shards',
      'Taming Marks & Pet advancement',
      'Truegold / Tempered Truegold / Truegold Dust',
      'Governor Gear',
      'Gathering',
      'Speedups',
    ],
  },
];


const CATEGORY_META = {
  buildings: { label: 'Buildings · City Construction', order: 1 },
  warAcademy: { label: 'War Academy · Research', order: 2 },
  govCharm: { label: 'Governor Charm', order: 3 },
  govGear: { label: 'Governor Gear', order: 4 },
  heroGear: { label: 'Hero Gear · Mithril / Forgehammer', order: 5 },
  widgets: { label: 'Hero Widgets', order: 6 },
  heroes: { label: 'Heroes · Shards', order: 7 },
  pets: { label: 'Pets · Taming / Advancement', order: 8 },
  troops: { label: 'Troops · Training / Promotion', order: 9 },
  miscRoulette: { label: 'Misc · Hero Roulette', order: 10 },
  miscGather: { label: 'Misc · Gathering', order: 11 },
  speedups: { label: 'Speedups', order: 12 },
};

const RES_KEYS = [
  'bread', 'wood', 'stone', 'iron', 'gold', 'truegold', 'tempered_truegold',
  'truegold_dust', 'widgets', 'forge_hammer', 'forgehammer', 'mithril', 'satin',
  'gilded_threads', 'artisans_vision', 'charm_guide', 'charm_design',
  'pet_food', 'growth_manual', 'nutrient_potion', 'promotion_medallion',
];

function rowLevel(step) {
  if (!step) return '';
  return String(step.level ?? step.target_lvl ?? step.target ?? step.to ?? '');
}

function stepCosts(step) {
  const costs = {};
  for (const k of RES_KEYS) {
    if (step[k] != null) {
      const n = parseCost(step[k]);
      if (n) costs[k === 'forgehammer' ? 'forge_hammer' : k] = n;
    }
  }
  return costs;
}

function stepPoints(step) {
  let p = 0;
  if (step.truegold) p += parseCost(step.truegold) * (SCORE_RULES.truegold || 0);
  if (step.tempered_truegold)
    p += parseCost(step.tempered_truegold) * (SCORE_RULES.tempered_truegold || 0);
  if (step.truegold_dust)
    p += parseCost(step.truegold_dust) * (SCORE_RULES.truegold_dust || 0);
  if (step.widgets) p += parseCost(step.widgets) * (SCORE_RULES.widgets || 0);
  if (step.forgehammer || step.forge_hammer)
    p += parseCost(step.forgehammer || step.forge_hammer) * (SCORE_RULES.forge_hammer || 0);
  if (step.mithril) p += parseCost(step.mithril) * (SCORE_RULES.mithril || 0);
  return p;
}

function stepTimeSec(step) {
  return parseTimeToSeconds(step.time || step.duration || '0');
}

function mergeCosts(maps) {
  const out = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m || {})) {
      out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

function collectTasks(state, dataMap) {
  const tasks = [];

  const bData = dataMap.buildings || {};
  for (const [name, s] of Object.entries(state.buildings || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getUpgradeSteps(bData[name] || [], s.from || '0', s.to);
    if (!steps.length) continue;
    tasks.push({
      id: `buildings:${name}`,
      category: 'buildings',
      page: 'Buildings',
      item: name,
      from: s.from || '0',
      to: s.to,
      speedup: !!s.speedup,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `buildings:${name}:${toLvl}`,
          category: 'buildings',
          label: `${name} → ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
          img: buildingImg(name),
        };
      }),
    });
  }

  const waRoot = dataMap.war_academy || {};
  const waData = waRoot['War Academy'] || waRoot;
  for (const [name, s] of Object.entries(state.warAcademy || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getUpgradeSteps(waData[name] || [], s.from || '0', s.to);
    if (!steps.length) continue;
    tasks.push({
      id: `warAcademy:${name}`,
      category: 'warAcademy',
      page: 'War Academy',
      item: name,
      from: s.from || '0',
      to: s.to,
      speedup: !!s.speedup,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `warAcademy:${name}:${toLvl}`,
          category: 'warAcademy',
          label: `${name} → lvl ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
          img: warAcademyImg(name),
        };
      }),
    });
  }

  const petRoot = dataMap.pets || {};
  const petData = petRoot.Pet || petRoot.Pets || petRoot;
  for (const [name, s] of Object.entries(state.pets || {})) {
    if (name === 'tamingMarks' || !s?.active || !s.to) continue;
    const rows = Array.isArray(petData[name]) ? petData[name] : petData[name]?.levels || [];
    const steps = getUpgradeSteps(rows, s.from || '0', s.to);
    if (!steps.length) continue;
    tasks.push({
      id: `pets:${name}`,
      category: 'pets',
      page: 'Pets',
      item: name,
      from: s.from || '0',
      to: s.to,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `pets:${name}:${toLvl}`,
          category: 'pets',
          label: `${name} → ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
          img: asset('grey_wolf.webp'),
        };
      }),
    });
  }

  // Taming marks card (if any points locked via pets settings)
  const tm = state.pets?.tamingMarks || state.settings?.tamingMarks;
  if (tm && (Number(tm.advanced) > 0 || Number(tm.common) > 0 || tm.active)) {
    tasks.push({
      id: 'pets:tamingMarks',
      category: 'pets',
      page: 'Pets',
      item: 'Taming Marks',
      from: '',
      to: '',
      steps: [
        {
          key: 'pets:tamingMarks:use',
          category: 'pets',
          label: 'Taming Marks (advanced / common)',
          costs: {},
          points: 0,
          timeSec: 0,
          note: 'Scores on pet / taming days only',
        },
      ],
    });
  }

  const ggData = dataMap.gov_gear || {};
  const gearRows = ggData['GOV Gear'] || ggData.Gear || (Array.isArray(ggData) ? ggData : []);
  for (const [name, s] of Object.entries(state.govGear || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getUpgradeSteps(gearRows, s.from || '0', s.to);
    if (!steps.length) continue;
    tasks.push({
      id: `govGear:${name}`,
      category: 'govGear',
      page: 'Gov Gear',
      item: name,
      from: s.from || '0',
      to: s.to,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `govGear:${name}:${toLvl}`,
          category: 'govGear',
          label: `${name} → ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
        };
      }),
    });
  }

  const gcData = dataMap.gov_charms || {};
  const charmRows = gcData['GOV Charm'] || (Array.isArray(gcData) ? gcData : []);
  for (const [name, s] of Object.entries(state.govCharm || {})) {
    if (!s?.active || !s.to) continue;
    const steps = getUpgradeSteps(charmRows, s.from || '0', s.to);
    if (!steps.length) continue;
    tasks.push({
      id: `govCharm:${name}`,
      category: 'govCharm',
      page: 'Gov Charm',
      item: name,
      from: s.from || '0',
      to: s.to,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `govCharm:${name}:${toLvl}`,
          category: 'govCharm',
          label: `${name} → ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
        };
      }),
    });
  }

  const hgData = dataMap.hero_gear || {};
  const hgRows = hgData['Hero Gear'] || (Array.isArray(hgData) ? hgData : []);
  const hg = state.heroGear || {};
  for (const item of hg.items || []) {
    if (!item?.active || !item.to) continue;
    const steps = getUpgradeSteps(hgRows, item.from || '0', item.to);
    if (!steps.length) continue;
    const id = item.id || 'gear';
    tasks.push({
      id: `heroGear:${id}`,
      category: 'heroGear',
      page: 'Hero Gear',
      item: `Gear #${id}`,
      from: item.from || '0',
      to: item.to,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `heroGear:${id}:${toLvl}`,
          category: 'heroGear',
          label: `Hero Gear → ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
        };
      }),
    });
  }
  for (const item of hg.forgeItems || []) {
    if (!item?.active || !item.to) continue;
    const forgeRows = hgData.Forge || hgData.Forgehammer || hgRows;
    const steps = getUpgradeSteps(forgeRows, item.from || '0', item.to);
    if (!steps.length) continue;
    const id = item.id || 'forge';
    tasks.push({
      id: `heroForge:${id}`,
      category: 'heroGear',
      page: 'Hero Gear',
      item: `Forge #${id}`,
      from: item.from || '0',
      to: item.to,
      steps: steps.map((st, i) => {
        const toLvl = rowLevel(st) || `step${i + 1}`;
        return {
          key: `heroForge:${id}:${toLvl}`,
          category: 'heroGear',
          label: `Forgehammer → ${toLvl}`,
          costs: stepCosts(st),
          points: stepPoints(st),
          timeSec: stepTimeSec(st),
        };
      }),
    });
  }

  const wRows = (dataMap.widgets || {}).Widgets || [];
  for (const [name, s] of Object.entries(state.widgets || {})) {
    if (!s?.active) continue;
    const from = parseInt(s.from, 10) || 0;
    const to = parseInt(s.to, 10) || 0;
    if (to <= from) continue;
    const steps = [];
    for (const row of wRows) {
      const cur = Number(row.current_lvl);
      const tgt = Number(row.target_lvl);
      if (cur >= from && tgt <= to && tgt > from) {
        steps.push({
          key: `widgets:${name}:${tgt}`,
          category: 'widgets',
          label: `${name} widgets ${cur}→${tgt}`,
          costs: { widgets: parseCost(row.widgets) || 0 },
          points: (parseCost(row.widgets) || 0) * (SCORE_RULES.widgets || 0),
          timeSec: 0,
        });
      }
    }
    if (steps.length) {
      tasks.push({
        id: `widgets:${name}`,
        category: 'widgets',
        page: 'Widgets',
        item: name,
        from: String(from),
        to: String(to),
        steps,
      });
    }
  }

  for (const [key, s] of Object.entries(state.troops || {})) {
    if (!s?.active) continue;
    tasks.push({
      id: `troops:${key}`,
      category: 'troops',
      page: 'Troops',
      item: key,
      from: s.level || s.from || '',
      to: s.to || s.level || '',
      speedup: !!s.speedup,
      steps: [
        {
          key: `troops:${key}:all`,
          category: 'troops',
          label: `Troops · ${key}`,
          costs: {},
          points: 0,
          timeSec: 0,
          note: 'Training / promotion — scores on Combat Training days',
        },
      ],
    });
  }

  for (const [name, s] of Object.entries(state.heroes || {})) {
    if (!s?.active) continue;
    tasks.push({
      id: `heroes:${name}`,
      category: 'heroes',
      page: 'Heroes',
      item: name,
      from: '',
      to: '',
      steps: [
        {
          key: `heroes:${name}:stars`,
          category: 'heroes',
          label: `${name} star upgrade`,
          costs: {},
          points: 0,
          timeSec: 0,
          note: 'Hero shards — Hero Development days',
        },
      ],
    });
  }

  const misc = state.misc || {};
  if (misc.rouletteActive && (parseCost(misc.roulette) || 0) > 0) {
    tasks.push({
      id: 'misc:roulette',
      category: 'miscRoulette',
      page: 'Misc',
      item: 'Hero Roulette',
      from: '',
      to: '',
      steps: [
        {
          key: 'misc:roulette:spins',
          category: 'miscRoulette',
          label: `Hero Roulette ×${parseCost(misc.roulette) || 0}`,
          costs: {},
          points: (parseCost(misc.roulette) || 0) * (SCORE_RULES.roulette || 8000),
          timeSec: 0,
        },
      ],
    });
  }
  if (misc.gatherActive) {
    tasks.push({
      id: 'misc:gather',
      category: 'miscGather',
      page: 'Misc',
      item: 'Gathering',
      from: '',
      to: '',
      steps: [
        {
          key: 'misc:gather:all',
          category: 'miscGather',
          label: 'Gathering marches / bison',
          costs: {},
          points: 0,
          timeSec: 0,
          note: 'Gather points count on Day 7',
        },
      ],
    });
  }

  return tasks;
}

function taskAllowedOnDay(task, dayInfo) {
  const cats = dayInfo.categories || [];
  if (cats.includes(task.category)) return true;
  // speedup-only relevance: show building/WA/troops with speedup on speedup days
  if (cats.includes('speedups') && task.speedup) {
    return ['buildings', 'warAcademy', 'troops'].includes(task.category);
  }
  return false;
}

export default function PlannerPage() {
  const { state, updateSection } = useApp();
  const b = useGameData('buildings');
  const wa = useGameData('war_academy');
  const pets = useGameData('pets');
  const gg = useGameData('gov_gear');
  const gc = useGameData('gov_charms');
  const hg = useGameData('hero_gear');
  const widgets = useGameData('widgets');

  const loading =
    b.loading || wa.loading || pets.loading || gg.loading || gc.loading || hg.loading || widgets.loading;

  const planner = state.planner || {};
  const selectedDay = Math.min(7, Math.max(1, parseInt(planner.selectedDay || '1', 10) || 1));
  const assignments = planner.assignments || {};

  const setPlanner = useCallback(
    (patch) => updateSection('planner', (prev) => ({ ...(prev || {}), ...patch })),
    [updateSection]
  );

  const setAssignment = (key, day) => {
    updateSection('planner', (prev) => ({
      ...(prev || {}),
      assignments: { ...(prev?.assignments || {}), [key]: day },
    }));
  };

  /** Assign every step in a list to the same day (bulk). */
  const setAssignmentsBulk = (keys, day) => {
    if (!keys?.length) return;
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
      gov_gear: gg.data,
      gov_charms: gc.data,
      hero_gear: hg.data,
      widgets: widgets.data,
    }),
    [b.data, wa.data, pets.data, gg.data, gc.data, hg.data, widgets.data]
  );

  const tasks = useMemo(() => collectTasks(state, dataMap), [state, dataMap]);

  const dayInfo = EVENT_DAYS[selectedDay - 1];

  const dayTasks = useMemo(
    () => tasks.filter((t) => taskAllowedOnDay(t, dayInfo)),
    [tasks, dayInfo]
  );

  const groupedDayTasks = useMemo(() => {
    const map = new Map();
    for (const t of dayTasks) {
      const cat = t.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(t);
    }
    return [...map.entries()]
      .map(([category, items]) => ({
        category,
        label: CATEGORY_META[category]?.label || category,
        order: CATEGORY_META[category]?.order ?? 99,
        items,
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [dayTasks]);

  const daySteps = useMemo(() => {
    const list = [];
    for (const t of dayTasks) {
      for (const s of t.steps) {
        const assigned = assignments[s.key];
        // default: show on this day if unassigned or assigned here
        const onThisDay = assigned == null || Number(assigned) === selectedDay;
        if (onThisDay) list.push({ ...s, taskId: t.id, page: t.page, item: t.item });
      }
    }
    return list;
  }, [dayTasks, assignments, selectedDay]);

  const summary = useMemo(() => {
    const costs = mergeCosts(daySteps.map((s) => s.costs));
    let points = 0;
    let timeSec = 0;
    for (const s of daySteps) {
      points += s.points || 0;
      timeSec += s.timeSec || 0;
    }
    return { costs, points, timeSec, count: daySteps.length };
  }, [daySteps]);

  const allowedDaysForStep = (step) => {
    const cat = step.category;
    return EVENT_DAYS.filter((d) => d.categories.includes(cat)).map((d) => d.day);
  };

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
      {/* Day tabs — fixed 7-day event */}
      <div
        className="planner-day-tabs"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
      >
        {EVENT_DAYS.map((d) => {
          const n = tasks.filter((t) => taskAllowedOnDay(t, d)).length;
          return (
            <button
              key={d.day}
              type="button"
              className="preset-btn"
              style={{
                opacity: selectedDay === d.day ? 1 : 0.7,
                fontWeight: selectedDay === d.day ? 700 : 500,
                borderWidth: selectedDay === d.day ? 2 : 1,
              }}
              onClick={() => setPlanner({ selectedDay: d.day })}
            >
              Day {d.day}: {d.title}
            </button>
          );
        })}
      </div>

      {/* Day info */}
      <div className="item-card" style={{ marginBottom: 16 }}>
        <div className="item-card-header">
          <span>
            Day {dayInfo.day} · {dayInfo.title}
          </span>
        </div>
        <div className="item-card-body">
          <div style={{ marginBottom: 8, fontSize: '0.9rem', opacity: 0.9 }}>
            Point sources today:
            <ul style={{ margin: '6px 0 0 18px' }}>
              {dayInfo.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className={`status-pane ${summary.count ? 'status-ok' : 'status-info'}`}>
            <div>
              Planned steps today: <strong>{summary.count}</strong>
            </div>
            <div>
              Est. points (from listed costs): <strong>+{formatNumber(summary.points)}</strong>
            </div>
            <div>
              Base build/research time:{' '}
              <strong>{formatSecondsToTime(summary.timeSec)}</strong>
            </div>
            {Object.keys(summary.costs).length > 0 && (
              <div style={{ marginTop: 8 }}>
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

      {!tasks.length && (
        <div className="status-pane status-warning">
          No active upgrades. On other pages, set levels and check <strong>Upgrade</strong> —
          matching items will appear on the days they can score.
        </div>
      )}

      {tasks.length > 0 && !dayTasks.length && (
        <div className="status-pane status-info">
          None of your active upgrades score on <strong>Day {dayInfo.day}</strong>. Try another
          day tab.
        </div>
      )}

      {groupedDayTasks.map((group) => (
        <section key={group.category} className="planner-category" style={{ marginBottom: 20 }}>
          <div
            className="planner-category-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              margin: '4px 0 10px',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--surface-dark, var(--hover-fill))',
              border: '1px solid var(--border-color)',
            }}
          >
            <strong style={{ fontSize: '1rem' }}>{group.label}</strong>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              {group.items.length} item{group.items.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="items-grid cards-grid">
            {group.items.map((t) => {
              const stepKeys = t.steps.map((s) => s.key);
              const allowedAll = (() => {
                // Intersection of allowed days across steps (same category → same days)
                let set = null;
                for (const s of t.steps) {
                  const a = allowedDaysForStep(s);
                  set = set == null ? new Set(a) : new Set(a.filter((d) => set.has(d)));
                }
                return set ? [...set].sort((a, b) => a - b) : [selectedDay];
              })();
              const stepDays = t.steps.map((s) => {
                const allowed = allowedDaysForStep(s);
                return assignments[s.key] != null && allowed.includes(Number(assignments[s.key]))
                  ? Number(assignments[s.key])
                  : selectedDay;
              });
              const allSame = stepDays.length > 0 && stepDays.every((d) => d === stepDays[0]);
              const bulkValue = allSame ? String(stepDays[0]) : '';
              return (
              <div className="item-card" key={t.id} data-category={t.category}>
                <div
                  className="item-card-header"
                  style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                >
                  {t.steps[0]?.img ? <AssetImg src={t.steps[0].img} size={36} /> : null}
                  <span>{t.item}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      opacity: 0.7,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.page}
                  </span>
                  {allowedAll.length > 0 && t.steps.length > 0 && (
                    <label
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.8rem',
                      }}
                      title="Set every step in this path to the same day"
                    >
                      <span style={{ opacity: 0.85 }}>All steps →</span>
                      <select
                        value={bulkValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setAssignmentsBulk(stepKeys, parseInt(v, 10));
                        }}
                      >
                        {!allSame && (
                          <option value="" disabled>
                            Mixed days
                          </option>
                        )}
                        {allowedAll.map((d) => (
                          <option key={d} value={d}>
                            Day {d}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="item-card-body">
                  {t.from && t.to && (
                    <div style={{ marginBottom: 8, fontSize: '0.85rem', opacity: 0.8 }}>
                      Path: <strong>{t.from}</strong> → <strong>{t.to}</strong>
                      {t.steps.length > 1 && (
                        <span style={{ opacity: 0.75 }}> · {t.steps.length} steps</span>
                      )}
                    </div>
                  )}
                  {t.steps.map((s) => {
                    const allowed = allowedDaysForStep(s);
                    const day =
                      assignments[s.key] != null && allowed.includes(Number(assignments[s.key]))
                        ? Number(assignments[s.key])
                        : selectedDay;
                    return (
                      <div
                        key={s.key}
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
                          <div style={{ fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                            {s.points > 0 && <>+{formatNumber(s.points)} pts · </>}
                            {s.timeSec > 0 && <>{formatSecondsToTime(s.timeSec)}</>}
                            {s.note && <span>{s.note}</span>}
                          </div>
                        </div>
                        {allowed.length > 1 ? (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.8rem' }}>Schedule</span>
                            <select
                              value={day}
                              onChange={(e) =>
                                setAssignment(s.key, parseInt(e.target.value, 10))
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
                            Day {allowed[0] || selectedDay} only
                          </span>
                        )}
                      </div>
                    );
                  })}
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
