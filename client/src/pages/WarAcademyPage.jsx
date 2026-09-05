import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { useScoreRules } from '../hooks/useScoreRules';
import { usePublishPageScore } from '../hooks/usePublishPageScore';
import ShowMaxedToggle, { useShowMaxedItems, isAtMaxLevel } from '../components/ShowMaxedToggle';
import { parseCost, getUpgradeSteps, getLevelsFromArray, parseTimeToSeconds, formatSecondsToTime, secondsToSpeedupMinutes, applyResearchSpeedupBuffs } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import { ResearchBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { LevelSelects } from '../components/LevelSelects';
import GroupCard from '../components/GroupCard';
import { warAcademyImg, troopImg } from '../utils/images';
import { collectStepRequirements, evaluateRequirements } from '../utils/prerequisites';
import PrereqList from '../components/PrereqList';

const RES = [
  'bread', 'wood', 'stone', 'iron', 'gold', 'truegold', 'truegold_dust', 'tempered_truegold',
];

const TECH_GROUPS = [
  {
    name: 'Infantry',
    icon: 'Infantry',
    techs: [
      'Truegold Battalion (Infantry)', 'Truegold Blades', 'Truegold Shields',
      'Truegold Legionaries (Infantry)', 'Truegold Mauls', 'Truegold Plating',
      'Truegold Infantry', 'Truegold Infantry Healing', 'Truegold Infantry Training', 'Truegold Infantry Aid',
    ],
  },
  {
    name: 'Cavalry',
    icon: 'Cavalry',
    techs: [
      'Truegold Battalion (Cavalry)', 'Truegold Charge', 'Truegold Farriery',
      'Truegold Legionaries (Cavalry)', 'Truegold Lances', 'Truegold Platecraft',
      'Truegold Cavalry', 'Truegold Cavalry Healing', 'Truegold Cavalry Training', 'Truegold Cavalry Aid',
    ],
  },
  {
    name: 'Archer',
    icon: 'Archer',
    techs: [
      'Truegold Battalion (Archer)', 'Truegold Bows', 'Truegold Bracers',
      'Truegold Legionaries (Archer)', 'Truegold Arrows', 'Truegold Vests',
      'Truegold Archer', 'Truegold Archer Healing', 'Truegold Archer Training', 'Truegold Archer Aid',
    ],
  },
];

export default function WarAcademyPage() {
  const { data, loading, error } = useGameData('war_academy');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
  const { scoreRules: SCORE_RULES, eventId: activeEventId } = useScoreRules();
  const vault = useMemo(
    () => remainingVaultExcluding('warAcademy'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const wa = state.warAcademy || {};
  const showMaxed = useShowMaxedItems();
  const buildingsState = state.buildings || {};
  const buffs = state.settings?.researchBuffs || {};
  const root = data?.['War Academy'] || data || {};

  const setField = (name, field, value) => {
    updateSection('warAcademy', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' || field === 'to') cur.active = false;
      // Persist default current level so Profile can detect from → to range
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
      if (!ordered.some((o) => o.name === name)) ordered.push({ name, group: 'Other' });
    }

    const raw = ordered.map(({ name, group }) => {
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
        dust += parseCost(step.truegold_dust);
        totalTime += parseTimeToSeconds(step.time || step.duration || '0');
      }
      Object.keys(costs).forEach((k) => { if (!costs[k]) delete costs[k]; });
      const buffedTime = applyResearchSpeedupBuffs(totalTime, buffs);
      let points = dust * SCORE_RULES.truegold_dust;
      const speedupMins =
        s.speedup && buffedTime > 0 ? secondsToSpeedupMinutes(buffedTime) : 0;
      // Speedup split (research → general) happens in sequentialAfford
      const reqRaw = collectStepRequirements(steps, name);
      const prereq = evaluateRequirements(reqRaw, buildingsState, wa);
      // Toggle lives on research buffs panel (default ON)
      const prereqEnabled = buffs.prereqCheck !== false;
      const prereqsMet = prereqEnabled ? prereq.allMet : true;
      return {
        id: name, name, group, levels, s, from, to, steps, costs, points,
        totalTime, buffedTime, speedupMins, active: !!s.active,
        prereq, prereqsMet, prereqEnabled,
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
        c.points + (usedSpd > 0 ? usedSpd * (SCORE_RULES.speedup_min ?? 0) : 0);
      return {
        ...c,
        costs: resolvedCosts,
        points: pts,
        canAfford,
        vaultBefore: a.vaultBefore,
        speedupAlloc: a.speedupAlloc,
      };
    });
  }, [root, wa, buildingsState, vault, buffs, SCORE_RULES, activeEventId]);

  const hasMaxedItems = useMemo(
    () => cards.some((c) => isAtMaxLevel(c.from, c.levels)),
    [cards]
  );

    const totalActivePoints = useMemo(
    () => cards.reduce((s, c) => s + (c.active && c.canAfford ? c.points : 0), 0),
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

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  const groups = [...TECH_GROUPS.map((g) => g.name), 'Other'];

  return (
    <div className="calculator-page">
      <ResearchBuffPanel />
      <ShowMaxedToggle hasMaxed={hasMaxedItems} />
      <div className="group-columns group-columns-3">
        {TECH_GROUPS.map((g) => {
          const groupCards = cards.filter((c) => c.group === g.name && (showMaxed || !isAtMaxLevel(c.from, c.levels)));
          if (!groupCards.length) return null;
          return (
            <GroupCard
              key={g.name}
              title={g.name}
              iconSrc={troopImg(g.icon)}
              iconAlt={g.name}
            >
              {groupCards.map((c) => (
                <div className="item-card group-card-item" key={c.name}>
                  <div className="item-card-header">
                    <AssetImg src={warAcademyImg(c.name)} size={40} />
                    <span>{c.name}</span>
                  </div>
                  <div className="item-card-body">
                    <LevelSelects
                      levels={c.levels}
                      from={c.from ?? ''}
                      to={c.to ?? ''}
                      onFrom={(v) => setField(c.name, 'from', v)}
                      onTo={(v) => setField(c.name, 'to', v)}
                    />
                    {(() => {
                      const atMax = c.levels.length > 0 && String(c.from ?? '0') === String(c.levels[c.levels.length - 1]);
                      return (
                    <>
                    {!atMax && (
                    <div className="checkbox-group">
                      <label
                        className="checkbox-label"
                        style={{ opacity: (c.canAfford && c.prereqsMet) || !c.to ? 1 : 0.5 }}
                        title={!c.prereqsMet ? 'Prerequisites not met' : undefined}
                      >
                        <input
                          className="checkbox" type="checkbox"
                          checked={!!c.active && c.canAfford && c.prereqsMet}
                          disabled={!c.to || !c.prereqsMet || (!c.canAfford && !c.active)}
                          onChange={(e) => setField(c.name, 'active', e.target.checked)}
                        />{' '}
                        Upgrade
                      </label>
                      <label className="checkbox-label">
                        <input
                          className="checkbox" type="checkbox"
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
                          <div>
                            Time: {formatSecondsToTime(c.buffedTime)}
                            {c.buffedTime !== c.totalTime && (
                              <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(c.totalTime)})</span>
                            )}
                          </div>
                        ) : null
                      }
                    />
                    </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </GroupCard>
          );
        })}
      </div>
      {cards.some((c) => c.group === 'Other' && (showMaxed || !isAtMaxLevel(c.from, c.levels))) && (
        <div className="group-columns group-columns-1" style={{ marginTop: 16 }}>
          <GroupCard title="Other">
            {cards.filter((c) => c.group === 'Other' && (showMaxed || !isAtMaxLevel(c.from, c.levels))).map((c) => (
              <div className="item-card group-card-item" key={c.name}>
                <div className="item-card-header">
                  <AssetImg src={warAcademyImg(c.name)} size={40} />
                  <span>{c.name}</span>
                </div>
                <div className="item-card-body">
                  <LevelSelects
                    levels={c.levels}
                    from={c.from ?? ''}
                    to={c.to ?? ''}
                    onFrom={(v) => setField(c.name, 'from', v)}
                    onTo={(v) => setField(c.name, 'to', v)}
                  />
                  {(() => {
                    const atMax = c.levels.length > 0 && String(c.from ?? '0') === String(c.levels[c.levels.length - 1]);
                    return (
                  <>
                  {!atMax && (
                  <div className="checkbox-group">
                    <label
                      className={`checkbox-label${!(c.canAfford && c.prereqsMet) || !c.to ? ' is-disabled' : ''}`}
                      style={{ opacity: (c.canAfford && c.prereqsMet) || !c.to ? 1 : 0.42 }}
                      title={!c.prereqsMet ? 'Prerequisites not met' : undefined}
                    >
                      <input
                        className="checkbox" type="checkbox"
                        checked={!!c.active && c.canAfford && c.prereqsMet}
                        disabled={!c.to || !c.prereqsMet || (!c.canAfford && !c.active)}
                        onChange={(e) => setField(c.name, 'active', e.target.checked)}
                      />{' '}
                      Upgrade
                    </label>
                    <label className="checkbox-label">
                      <input
                        className="checkbox" type="checkbox"
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
                    costs={c.costs}
                    vault={c.vaultBefore || vault}
                  />
                  </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </GroupCard>
        </div>
      )}
    </div>
  );
}
