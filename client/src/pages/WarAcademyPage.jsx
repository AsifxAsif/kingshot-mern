import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useSiteConfig, applyOrder } from '../hooks/useSiteConfig';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { useScoreRules } from '../hooks/useScoreRules';
import { usePublishPageScore } from '../hooks/usePublishPageScore';
import { useShowMaxedItems, isAtMaxLevel } from '../components/ShowMaxedToggle';
import PageOptionsBar from '../components/PageOptionsBar';
import {
  parseCost,
  getUpgradeSteps,
  getLevelsFromArray,
  parseTimeToSeconds,
  formatSecondsToTime,
  secondsToSpeedupMinutes,
  applyResearchSpeedupBuffs,
  convertLevelToNumeric,
} from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import { ResearchBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { LevelSelects } from '../components/LevelSelects';
import GroupCard from '../components/GroupCard';
import { warAcademyImg, troopImg } from '../utils/images';
import { collectStepRequirements, evaluateRequirements } from '../utils/prerequisites';
import PrereqList from '../components/PrereqList';
import { PageSkeleton } from '../components/Skeleton';

const RES = [
  'bread',
  'wood',
  'stone',
  'iron',
  'gold',
  'truegold',
  'truegold_dust',
  'tempered_truegold',
];

const TECH_GROUPS = [
  {
    name: 'Infantry',
    icon: 'Infantry',
    techs: [
      'Truegold Battalion (Infantry)',
      'Truegold Blades',
      'Truegold Shields',
      'Truegold Legionaries (Infantry)',
      'Truegold Mauls',
      'Truegold Plating',
      'Truegold Infantry',
      'Truegold Infantry Healing',
      'Truegold Infantry Training',
      'Truegold Infantry Aid',
    ],
  },
  {
    name: 'Cavalry',
    icon: 'Cavalry',
    techs: [
      'Truegold Battalion (Cavalry)',
      'Truegold Charge',
      'Truegold Farriery',
      'Truegold Legionaries (Cavalry)',
      'Truegold Lances',
      'Truegold Platecraft',
      'Truegold Cavalry',
      'Truegold Cavalry Healing',
      'Truegold Cavalry Training',
      'Truegold Cavalry Aid',
    ],
  },
  {
    name: 'Archer',
    icon: 'Archer',
    techs: [
      'Truegold Battalion (Archer)',
      'Truegold Bows',
      'Truegold Bracers',
      'Truegold Legionaries (Archer)',
      'Truegold Arrows',
      'Truegold Vests',
      'Truegold Archer',
      'Truegold Archer Healing',
      'Truegold Archer Training',
      'Truegold Archer Aid',
    ],
  },
];

/**
 * Game-style tree layout (matches in-game research screen).
 * Grid: 5 columns × 5 rows
 *
 *      col1      col2      col3      col4      col5
 * r1:                    Battalion
 * r2:           Weapon            Armor
 * r3:  Weapon+       Legionaries       Armor+
 * r4:                    Troop
 * r5:     Heal         Training         Aid
 *
 * edges: parent → child with min parent level to unlock the link
 */
const WA_TREES = {
  Infantry: {
    icon: 'Infantry',
    nodes: {
      'Truegold Battalion (Infantry)': { col: 3, row: 1 },
      'Truegold Blades': { col: 2, row: 2 },
      'Truegold Shields': { col: 4, row: 2 },
      'Truegold Mauls': { col: 1, row: 3 },
      'Truegold Legionaries (Infantry)': { col: 3, row: 3 },
      'Truegold Plating': { col: 5, row: 3 },
      'Truegold Infantry': { col: 3, row: 4 },
      'Truegold Infantry Healing': { col: 1, row: 5 },
      'Truegold Infantry Training': { col: 3, row: 5 },
      'Truegold Infantry Aid': { col: 5, row: 5 },
    },
    edges: [
      { from: 'Truegold Battalion (Infantry)', to: 'Truegold Blades', need: 3 },
      { from: 'Truegold Battalion (Infantry)', to: 'Truegold Shields', need: 3 },
      { from: 'Truegold Blades', to: 'Truegold Mauls', need: 6 },
      { from: 'Truegold Blades', to: 'Truegold Legionaries (Infantry)', need: 6 },
      { from: 'Truegold Shields', to: 'Truegold Plating', need: 6 },
      { from: 'Truegold Shields', to: 'Truegold Legionaries (Infantry)', need: 6 },
      { from: 'Truegold Mauls', to: 'Truegold Infantry', need: 12 },
      {
        from: 'Truegold Legionaries (Infantry)',
        to: 'Truegold Infantry',
        need: 12,
      },
      { from: 'Truegold Plating', to: 'Truegold Infantry', need: 12 },
      { from: 'Truegold Infantry', to: 'Truegold Infantry Healing', need: 1 },
      { from: 'Truegold Infantry', to: 'Truegold Infantry Training', need: 1 },
      { from: 'Truegold Infantry', to: 'Truegold Infantry Aid', need: 1 },
    ],
  },
  Cavalry: {
    icon: 'Cavalry',
    nodes: {
      'Truegold Battalion (Cavalry)': { col: 3, row: 1 },
      'Truegold Charge': { col: 2, row: 2 },
      'Truegold Farriery': { col: 4, row: 2 },
      'Truegold Lances': { col: 1, row: 3 },
      'Truegold Legionaries (Cavalry)': { col: 3, row: 3 },
      'Truegold Platecraft': { col: 5, row: 3 },
      'Truegold Cavalry': { col: 3, row: 4 },
      'Truegold Cavalry Healing': { col: 1, row: 5 },
      'Truegold Cavalry Training': { col: 3, row: 5 },
      'Truegold Cavalry Aid': { col: 5, row: 5 },
    },
    edges: [
      { from: 'Truegold Battalion (Cavalry)', to: 'Truegold Charge', need: 3 },
      { from: 'Truegold Battalion (Cavalry)', to: 'Truegold Farriery', need: 3 },
      { from: 'Truegold Charge', to: 'Truegold Lances', need: 6 },
      { from: 'Truegold Charge', to: 'Truegold Legionaries (Cavalry)', need: 6 },
      { from: 'Truegold Farriery', to: 'Truegold Platecraft', need: 6 },
      { from: 'Truegold Farriery', to: 'Truegold Legionaries (Cavalry)', need: 6 },
      { from: 'Truegold Lances', to: 'Truegold Cavalry', need: 12 },
      {
        from: 'Truegold Legionaries (Cavalry)',
        to: 'Truegold Cavalry',
        need: 12,
      },
      { from: 'Truegold Platecraft', to: 'Truegold Cavalry', need: 12 },
      { from: 'Truegold Cavalry', to: 'Truegold Cavalry Healing', need: 1 },
      { from: 'Truegold Cavalry', to: 'Truegold Cavalry Training', need: 1 },
      { from: 'Truegold Cavalry', to: 'Truegold Cavalry Aid', need: 1 },
    ],
  },
  Archer: {
    icon: 'Archer',
    nodes: {
      'Truegold Battalion (Archer)': { col: 3, row: 1 },
      'Truegold Bows': { col: 2, row: 2 },
      'Truegold Bracers': { col: 4, row: 2 },
      'Truegold Arrows': { col: 1, row: 3 },
      'Truegold Legionaries (Archer)': { col: 3, row: 3 },
      'Truegold Vests': { col: 5, row: 3 },
      'Truegold Archer': { col: 3, row: 4 },
      'Truegold Archer Healing': { col: 1, row: 5 },
      'Truegold Archer Training': { col: 3, row: 5 },
      'Truegold Archer Aid': { col: 5, row: 5 },
    },
    edges: [
      { from: 'Truegold Battalion (Archer)', to: 'Truegold Bows', need: 3 },
      { from: 'Truegold Battalion (Archer)', to: 'Truegold Bracers', need: 3 },
      { from: 'Truegold Bows', to: 'Truegold Arrows', need: 6 },
      { from: 'Truegold Bows', to: 'Truegold Legionaries (Archer)', need: 6 },
      { from: 'Truegold Bracers', to: 'Truegold Vests', need: 6 },
      { from: 'Truegold Bracers', to: 'Truegold Legionaries (Archer)', need: 6 },
      { from: 'Truegold Arrows', to: 'Truegold Archer', need: 12 },
      {
        from: 'Truegold Legionaries (Archer)',
        to: 'Truegold Archer',
        need: 12,
      },
      { from: 'Truegold Vests', to: 'Truegold Archer', need: 12 },
      { from: 'Truegold Archer', to: 'Truegold Archer Healing', need: 1 },
      { from: 'Truegold Archer', to: 'Truegold Archer Training', need: 1 },
      { from: 'Truegold Archer', to: 'Truegold Archer Aid', need: 1 },
    ],
  },
};

/** Orthogonal path from parent bottom-center → child top-center (game-like elbows) */
function buildEdgePath(x1, y1, x2, y2) {
  const midY = y1 + (y2 - y1) * 0.45;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

function WarAcademyTechCard({ c, setField, vault, nodeRef }) {
  const atMax =
    c.levels.length > 0 &&
    String(c.from ?? '0') === String(c.levels[c.levels.length - 1]);
  const fromN = convertLevelToNumeric(c.from ?? '0');
  const unlocked = fromN > 0 || atMax;

  return (
    <div
      ref={nodeRef}
      className={`item-card group-card-item wa-tree-node${unlocked ? ' is-unlocked' : ''}${atMax ? ' is-maxed' : ''}`}
      data-tech={c.name}
    >
      <div className="item-card-header">
        <AssetImg src={warAcademyImg(c.name)} size={40} />
        <span>{c.name}</span>
        {atMax ? <span className="wa-node-badge wa-node-max">MAX</span> : null}
        {!atMax && fromN > 0 ? (
          <span className="wa-node-badge">
            {fromN}/{c.levels[c.levels.length - 1] || '?'}
          </span>
        ) : null}
      </div>
      <div className="item-card-body">
        <LevelSelects
          levels={c.levels}
          from={c.from ?? ''}
          to={c.to ?? ''}
          onFrom={(v) => setField(c.name, 'from', v)}
          onTo={(v) => setField(c.name, 'to', v)}
        />
        {!atMax && (
          <div className="checkbox-group">
            <label
              className="checkbox-label"
              style={{
                opacity: (c.canAfford && c.prereqsMet) || !c.to ? 1 : 0.5,
              }}
              title={!c.prereqsMet ? 'Prerequisites not met' : undefined}
            >
              <input
                className="checkbox"
                type="checkbox"
                checked={!!c.active && c.canAfford && c.prereqsMet}
                disabled={!c.to || !c.prereqsMet || (!c.canAfford && !c.active)}
                onChange={(e) => setField(c.name, 'active', e.target.checked)}
              />{' '}
              Upgrade
            </label>
            <label className="checkbox-label">
              <input
                className="checkbox"
                type="checkbox"
                checked={!!c.s.speedup}
                onChange={(e) => setField(c.name, 'speedup', e.target.checked)}
              />{' '}
              +Speedups
            </label>
          </div>
        )}
        {c.prereqEnabled && c.steps.length > 0 && c.prereq?.items?.length > 0 && (
          <PrereqList items={c.prereq.items} />
        )}
        <CostStatus
          active={!!c.active && c.canAfford && c.prereqsMet}
          hasSelection={!!c.to}
          atMax={atMax}
          points={c.points}
          stepsInfo={c.steps.length ? ` (${c.steps.length} steps)` : ''}
          costs={c.costs}
          vault={c.vaultBefore || vault}
          extra={
            c.steps.length > 0 ? (
              <div className="status-time-line">⏱️ {formatSecondsToTime(c.buffedTime)}</div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function ResearchTree({
  troopTab,
  cardsByName,
  showMaxed,
  setField,
  vault,
}) {
  const tree = WA_TREES[troopTab] || WA_TREES.Infantry;
  const containerRef = useRef(null);
  const nodeRefs = useRef({});
  const [lines, setLines] = useState([]);

  const setNodeRef = useCallback((name, el) => {
    if (el) nodeRefs.current[name] = el;
    else delete nodeRefs.current[name];
  }, []);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    const next = [];
    for (const edge of tree.edges) {
      const fromEl = nodeRefs.current[edge.from];
      const toEl = nodeRefs.current[edge.to];
      if (!fromEl || !toEl) continue;
      const a = fromEl.getBoundingClientRect();
      const b = toEl.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - rootBox.left;
      const y1 = a.bottom - rootBox.top;
      const x2 = b.left + b.width / 2 - rootBox.left;
      const y2 = b.top - rootBox.top;
      const parentCard = cardsByName.get(edge.from);
      const parentLv = convertLevelToNumeric(parentCard?.from ?? '0');
      // Link is "live" when parent has reached the unlock level for this child
      const active = parentLv >= edge.need;
      next.push({
        key: `${edge.from}->${edge.to}`,
        d: buildEdgePath(x1, y1, x2, y2),
        active,
        need: edge.need,
        from: edge.from,
        to: edge.to,
      });
    }
    setLines(next);
  }, [tree, cardsByName]);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return undefined;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (ro) ro.observe(root);
    window.addEventListener('resize', measure);
    // Re-measure after fonts/images settle
    const t = setTimeout(measure, 80);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, [measure, troopTab, showMaxed, cardsByName]);

  const visibleNodes = Object.entries(tree.nodes).filter(([name]) => {
    const c = cardsByName.get(name);
    if (!c) return false;
    if (!showMaxed && isAtMaxLevel(c.from, c.levels)) return false;
    return true;
  });

  // Group by row so same-row cards sit side-by-side with tight gaps (no empty columns)
  const rows = {};
  for (const [name, pos] of visibleNodes) {
    const r = pos.row;
    if (!rows[r]) rows[r] = [];
    rows[r].push([name, pos]);
  }
  const rowKeys = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);
  for (const r of rowKeys) {
    rows[r].sort((a, b) => a[1].col - b[1].col);
  }

  const themeClass =
    troopTab === 'Cavalry'
      ? 'theme-cavalry'
      : troopTab === 'Archer'
        ? 'theme-archer'
        : 'theme-infantry';

  return (
    <div className={`wa-tree-board ${themeClass}`} ref={containerRef}>
      <svg className="wa-tree-lines" aria-hidden>
        {lines.map((ln) => (
          <path
            key={ln.key}
            d={ln.d}
            className={`wa-tree-line${ln.active ? ' is-active' : ''}`}
            fill="none"
          />
        ))}
      </svg>
      <div className="wa-tree-grid">
        {rowKeys.map((r) => {
          const items = rows[r];
          const n = items.length;
          return (
            <div
              key={r}
              className={`wa-tree-row wa-tree-row-n${n}`}
              data-row={r}
            >
              {items.map(([name]) => {
                const c = cardsByName.get(name);
                if (!c) return null;
                return (
                  <div key={name} className="wa-tree-cell">
                    <WarAcademyTechCard
                      c={c}
                      setField={setField}
                      vault={vault}
                      nodeRef={(el) => setNodeRef(name, el)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WarAcademyPage() {
  const { data, loading, error } = useGameData('war_academy');
  const { state, updateSection, setPageLockedCosts, remainingVaultExcluding } =
    useApp();
  const { scoreRules: SCORE_RULES, eventId: activeEventId } = useScoreRules();
  const vault = useMemo(
    () => remainingVaultExcluding('warAcademy'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const wa = state.warAcademy || {};
  const { orders } = useSiteConfig();
  const showMaxed = useShowMaxedItems();
  const buildingsState = state.buildings || {};
  const buffs = state.settings?.researchBuffs || {};
  const prereqEnabled = buffs.prereqCheck !== false;
  const setPrereqEnabled = (checked) => {
    updateSection('settings', (prev) => ({
      ...(prev || {}),
      researchBuffs: {
        ...((prev || {}).researchBuffs || {}),
        prereqCheck: checked,
      },
    }));
  };

  const troopTab =
    state.settings?.warAcademyTroopTab &&
    WA_TREES[state.settings.warAcademyTroopTab]
      ? state.settings.warAcademyTroopTab
      : 'Infantry';
  const setTroopTab = (name) => {
    updateSection('settings', (prev) => ({
      ...(prev || {}),
      warAcademyTroopTab: name,
    }));
  };

  const root = data?.['War Academy'] || data || {};

  const setField = (name, field, value) => {
    updateSection('warAcademy', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' || field === 'to') cur.active = false;
      if (field === 'to' && (cur.from == null || cur.from === '')) cur.from = '0';
      return { ...prev, [name]: cur };
    });
  };

  const cards = useMemo(() => {
    const allNames = Object.keys(root).filter((k) => Array.isArray(root[k]));
    const ordered = [];
    for (const g of TECH_GROUPS) {
      for (const name of g.techs) {
        if (allNames.includes(name)) ordered.push({ name, group: g.name });
      }
    }
    for (const name of allNames) {
      if (!ordered.some((o) => o.name === name))
        ordered.push({ name, group: 'Other' });
    }

    const orderedNames = applyOrder(
      ordered.map((o) => o.name),
      orders.war_academy,
      (x) => x
    );
    const byName = Object.fromEntries(ordered.map((o) => [o.name, o]));
    const orderedFinal = orderedNames.map((n) => byName[n]).filter(Boolean);

    const raw = orderedFinal.map(({ name, group }) => {
      const rows = root[name] || [];
      const levels = getLevelsFromArray(rows);
      const s = wa[name] || {};
      const from = s.from ?? '0';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from || '0', to) : [];
      const costs = {};
      let dust = 0;
      let totalTime = 0;
      for (const step of steps) {
        for (const k of RES) {
          if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
        }
        if (step.truegold_dust != null) dust += parseCost(step.truegold_dust);
        totalTime += parseTimeToSeconds(step.time || step.duration || '0');
      }
      const points = dust * (SCORE_RULES.truegold_dust || 0);
      const buffedTime = applyResearchSpeedupBuffs(totalTime, buffs);
      const speedupMins = s.speedup ? secondsToSpeedupMinutes(buffedTime) : 0;
      Object.keys(costs).forEach((k) => {
        if (!costs[k]) delete costs[k];
      });
      const reqRaw = collectStepRequirements(steps, name);
      const prereq = evaluateRequirements(reqRaw, buildingsState, wa);
      const prereqOn = buffs.prereqCheck !== false;
      const prereqsMet = prereqOn ? prereq.allMet : true;
      return {
        id: name,
        name,
        group,
        levels,
        s,
        from,
        to,
        steps,
        costs,
        points,
        totalTime,
        buffedTime,
        speedupMins,
        active: !!s.active,
        prereq,
        prereqsMet,
        prereqEnabled: prereqOn,
        speedupKey: 'research_speedup',
      };
    });

    const afford = sequentialAfford(
      raw.map((c) => ({
        id: c.id,
        costs: c.costs,
        active: c.active && c.prereqsMet,
        speedupMins: c.speedupMins,
        speedupKey: c.speedupKey,
      })),
      vault
    );

    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      const canAfford = a.canAfford && c.prereqsMet;
      const resolvedCosts = a.resolvedCosts || c.costs;
      const usedSpd = a.speedupAlloc?.used ?? 0;
      const pts =
        (c.points || 0) +
        (usedSpd > 0 ? usedSpd * (SCORE_RULES.speedup_min ?? 0) : 0);
      return {
        ...c,
        costs: resolvedCosts,
        points: pts,
        canAfford,
        vaultBefore: a.vaultBefore,
        active: !!c.active && canAfford,
      };
    });
  }, [root, wa, vault, buildingsState, buffs, SCORE_RULES, orders.war_academy]);

  const cardsByName = useMemo(() => {
    const m = new Map();
    for (const c of cards) m.set(c.name, c);
    return m;
  }, [cards]);

  const hasMaxedItems = useMemo(
    () => cards.some((c) => isAtMaxLevel(c.from, c.levels)),
    [cards]
  );

  const totalActivePoints = useMemo(
    () =>
      cards.reduce((s, c) => s + (c.active && c.canAfford ? c.points : 0), 0),
    [cards]
  );

  useEffect(() => {
    setPageLockedCosts(
      'warAcademy',
      sumActiveCosts(
        cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
        new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
      )
    );
  }, [cards, setPageLockedCosts, SCORE_RULES, activeEventId]);

  usePublishPageScore('warAcademy', totalActivePoints);

  if (loading && !data)
    return (
      <div className="page-loading">
        <PageSkeleton cards={6} label="Loading" />
      </div>
    );
  if (error)
    return (
      <div className="page-error">
        <p>{error}</p>
      </div>
    );

  const otherCards = cards.filter(
    (c) => c.group === 'Other' && (showMaxed || !isAtMaxLevel(c.from, c.levels))
  );

  return (
    <div className="calculator-page war-academy-page">
      <ResearchBuffPanel />
      <PageOptionsBar
        hasMaxed={hasMaxedItems}
        showPrereq
        prereqEnabled={prereqEnabled}
        onPrereqChange={setPrereqEnabled}
        prereqTitle="When on, Upgrade is blocked until tech / building prerequisites are met"
      />

      <div className="wa-troop-tabs" role="tablist" aria-label="Troop type">
        {Object.entries(WA_TREES).map(([name, meta]) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={troopTab === name}
            className={`wa-troop-tab${troopTab === name ? ' is-active' : ''}`}
            onClick={() => setTroopTab(name)}
          >
            <AssetImg src={troopImg(meta.icon)} size={28} alt="" />
            <span>{name}</span>
          </button>
        ))}
      </div>

      <ResearchTree
        troopTab={troopTab}
        cardsByName={cardsByName}
        showMaxed={showMaxed}
        setField={setField}
        vault={vault}
      />

      {otherCards.length > 0 && (
        <div className="group-columns group-columns-1">
          <GroupCard title="Other">
            {otherCards.map((c) => (
              <WarAcademyTechCard
                key={c.name}
                c={c}
                setField={setField}
                vault={vault}
              />
            ))}
          </GroupCard>
        </div>
      )}
    </div>
  );
}
