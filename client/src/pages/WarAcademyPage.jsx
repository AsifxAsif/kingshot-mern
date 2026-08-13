import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import {
  parseCost,
  getUpgradeSteps,
  getLevelsFromArray,
  SCORE_RULES,
  parseTimeToSeconds,
  formatSecondsToTime,
  secondsToSpeedupMinutes,
  applyResearchSpeedupBuffs,
} from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import { ResearchBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { LevelSelects } from '../components/LevelSelects';
import GroupCard from '../components/GroupCard';
import { warAcademyImg, troopImg } from '../utils/images';

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
  const vault = useMemo(
    () => remainingVaultExcluding('warAcademy'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const wa = state.warAcademy || {};
  const buffs = state.settings?.researchBuffs || {};
  const root = data?.['War Academy'] || data || {};

  const setField = (name, field, value) => {
    updateSection('warAcademy', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' || field === 'to') cur.active = false;
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
      const speedupMins = secondsToSpeedupMinutes(buffedTime);
      if (s.speedup && speedupMins > 0) {
        costs.research_speedup = (costs.research_speedup || 0) + speedupMins;
        points += speedupMins * (SCORE_RULES.speedup_min || 0);
      }
      return {
        id: name, name, group, levels, s, from, to, steps, costs, points,
        totalTime, buffedTime, active: !!s.active,
      };
    });

    const afford = sequentialAfford(
      raw.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      vault
    );
    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      return { ...c, canAfford: a.canAfford, vaultBefore: a.vaultBefore };
    });
  }, [root, wa, vault, buffs]);

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
  }, [cards, setPageLockedCosts]);

  useEffect(() => {
    setPageScore('warAcademy', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  const groups = [...TECH_GROUPS.map((g) => g.name), 'Other'];

  return (
    <div className="calculator-page">
      <ResearchBuffPanel />
      <div className="group-columns group-columns-3">
        {TECH_GROUPS.map((g) => {
          const groupCards = cards.filter((c) => c.group === g.name);
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
                    <div className="checkbox-group">
                      <label className="checkbox-label" style={{ opacity: c.canAfford || !c.to ? 1 : 0.5 }}>
                        <input
                          type="checkbox"
                          checked={!!c.active && c.canAfford}
                          disabled={!c.to || (!c.canAfford && !c.active)}
                          onChange={(e) => setField(c.name, 'active', e.target.checked)}
                        />{' '}
                        Active
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!c.s.speedup}
                          onChange={(e) => setField(c.name, 'speedup', e.target.checked)}
                        />{' '}
                        +Speedups
                      </label>
                    </div>
                    <CostStatus
                      active={!!c.active && c.canAfford}
                      hasSelection={!!c.to}
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
                  </div>
                </div>
              ))}
            </GroupCard>
          );
        })}
      </div>
      {cards.some((c) => c.group === 'Other') && (
        <div className="group-columns group-columns-1" style={{ marginTop: 16 }}>
          <GroupCard title="Other">
            {cards.filter((c) => c.group === 'Other').map((c) => (
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
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!c.active && c.canAfford}
                        disabled={!c.to || (!c.canAfford && !c.active)}
                        onChange={(e) => setField(c.name, 'active', e.target.checked)}
                      />{' '}
                      Active
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!c.s.speedup}
                        onChange={(e) => setField(c.name, 'speedup', e.target.checked)}
                      />{' '}
                      +Speedups
                    </label>
                  </div>
                  <CostStatus
                    active={!!c.active && c.canAfford}
                    hasSelection={!!c.to}
                    points={c.points}
                    costs={c.costs}
                    vault={c.vaultBefore || vault}
                  />
                </div>
              </div>
            ))}
          </GroupCard>
        </div>
      )}
    </div>
  );
}
