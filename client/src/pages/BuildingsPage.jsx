import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import {
  parseCost,
  parseTimeToSeconds,
  formatNumber,
  formatSecondsToTime,
  getUpgradeSteps,
  SCORE_RULES,
  convertLevelToNumeric,
  sortLevels,
  applyBuildingSpeedupBuffs,
  secondsToSpeedupMinutes,
} from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import { BuildingBuffPanel } from '../components/BuffPanel';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { buildingImg } from '../utils/images';

const RESOURCE_KEYS = [
  'bread', 'wood', 'stone', 'iron', 'gold',
  'truegold', 'tempered_truegold', 'truegold_dust',
];

function getBuildingLevels(dataArray, buildingName) {
  // Levels come from data only. Always include baseline 0 (not unlocked).
  // Town Center data starts at 2 — do NOT invent level 1.
  const levels = new Set(['0']);
  for (const item of dataArray || []) {
    const lvl = item.level ?? item.current_lvl ?? item.current;
    if (lvl !== undefined && lvl !== null && lvl !== '') levels.add(String(lvl));
    const tgt = item.target_lvl ?? item.target;
    if (tgt !== undefined && tgt !== null && tgt !== '') levels.add(String(tgt));
  }
  return sortLevels(Array.from(levels));
}

function getNextLevel(levels, from) {
  const fromNum = convertLevelToNumeric(from);
  for (const lvl of levels) {
    if (convertLevelToNumeric(lvl) > fromNum) return String(lvl);
  }
  return '';
}

export default function BuildingsPage() {
  const { data, loading, error } = useGameData('buildings');
  const {
    state, updateSection, setPageScore, setPageLockedCosts,
    remainingVaultExcluding,
  } = useApp();
  const bState = state.buildings || {};
  const buffs = state.settings?.buildingBuffs || {};
  // Base vault after OTHER pages' locks (stable via useMemo on underlying state)
  const baseVault = useMemo(
    () => remainingVaultExcluding('buildings'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );

  const buildingNames = useMemo(
    () => (data ? Object.keys(data).filter((k) => Array.isArray(data[k])) : []),
    [data]
  );

  const setField = (name, field, value) => {
    updateSection('buildings', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' && data?.[name]) {
        const levels = getBuildingLevels(data[name], name);
        const next = getNextLevel(levels, value);
        if (next) cur.to = next;
        cur.active = false;
      }
      if (field === 'to') cur.active = false;
      return { ...prev, [name]: cur };
    });
  };

  const cards = useMemo(() => {
    if (!data) return [];
    const raw = buildingNames.map((name) => {
      const rows = data[name] || [];
      const levels = getBuildingLevels(rows, name);
      const s = bState[name] || {};
      const from = s.from ?? '0';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from || '0', to) : [];
      const costs = {};
      let points = 0;
      let totalTime = 0;
      for (const step of steps) {
        for (const k of RESOURCE_KEYS) {
          if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
        }
        if (step.truegold) points += parseCost(step.truegold) * SCORE_RULES.truegold;
        if (step.tempered_truegold)
          points += parseCost(step.tempered_truegold) * SCORE_RULES.tempered_truegold;
        totalTime += parseTimeToSeconds(step.time || step.duration || '0');
      }
      const saulPct = parseFloat(buffs.saul) || 0;
      if (saulPct > 0) {
        for (const k of ['bread', 'wood', 'stone', 'iron']) {
          if (costs[k]) costs[k] = Math.ceil(costs[k] * (1 - saulPct / 100));
        }
      }
      const buffedTime = applyBuildingSpeedupBuffs(totalTime, buffs);
      const speedupMins = secondsToSpeedupMinutes(buffedTime);
      if (s.speedup) {
        costs.building_speedup = (costs.building_speedup || 0) + speedupMins;
        points += speedupMins * SCORE_RULES.speedup_min;
      }
      Object.keys(costs).forEach((k) => { if (!costs[k]) delete costs[k]; });
      return {
        id: name, name, levels, s, from, to, steps, costs, points,
        totalTime, buffedTime, speedupMins, active: !!s.active,
      };
    });
    const afford = sequentialAfford(
      raw.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      baseVault
    );
    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: baseVault };
      return { ...c, canAfford: a.canAfford, vaultBefore: a.vaultBefore };
    });
  }, [data, buildingNames, bState, buffs, baseVault]);

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const c of cards) {
      if (c.active && c.canAfford && c.steps.length) total += c.points;
    }
    return total;
  }, [cards]);

  useEffect(() => {
    const locked = sumActiveCosts(
      cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active && c.steps.length > 0 })),
      new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
    );
    setPageLockedCosts('buildings', locked);
  }, [cards, setPageLockedCosts]);

  useEffect(() => {
    setPageScore('buildings', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading buildings…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      <BuildingBuffPanel />
      <div className="items-grid cards-grid">
        {cards.map((c) => (
          <div className="item-card" key={c.name} data-type="building">
            <div className="item-card-header">
              <AssetImg src={buildingImg(c.name)} size={50} />
              <span>{c.name}</span>
            </div>
            <div className="item-card-body">
              <LevelSelects
                levels={c.levels}
                from={c.from}
                to={c.to}
                onFrom={(v) => setField(c.name, 'from', v)}
                onTo={(v) => setField(c.name, 'to', v)}
              />
              <div className="checkbox-group">
                <label className="checkbox-label" style={{ opacity: c.canAfford || !c.to ? 1 : 0.5 }}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={!!c.active && c.canAfford}
                    disabled={!c.to || (!c.canAfford && !c.active)}
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
              <CostStatus
                active={!!c.active && c.canAfford}
                hasSelection={!!c.to}
                points={c.points}
                stepsInfo={c.steps.length ? ` (${c.steps.length} steps)` : ''}
                costs={c.costs}
                vault={c.vaultBefore || baseVault}
                extra={
                  c.steps.length > 0 ? (
                    <div>
                      Time: {formatSecondsToTime(c.buffedTime)}
                      {c.buffedTime !== c.totalTime && (
                        <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(c.totalTime)})</span>
                      )}
                      {c.s.speedup && (
                        <div>Speedup: {formatNumber(c.speedupMins)} min</div>
                      )}
                    </div>
                  ) : null
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
