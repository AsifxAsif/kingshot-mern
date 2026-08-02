import { useMemo, useEffect, useRef } from 'react';
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
  getAvailableSpeedups,
  calculateSpeedupUsage,
} from '../utils/calc';
import { computeAffordability } from '../utils/resources';
import { BuildingBuffPanel } from '../components/BuffPanel';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { buildingImg, resourceImg } from '../utils/images';

const RESOURCE_KEYS = [
  'bread', 'wood', 'stone', 'iron', 'gold',
  'truegold', 'tempered_truegold', 'truegold_dust',
];

function getBuildingLevels(dataArray, buildingName) {
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
  const { state, updateSection, setPageScore, vault } = useApp();
  const bState = state.buildings || {};
  const buffs = state.settings?.buildingBuffs || {};
  const prevScoreRef = useRef(0);

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
        cur.speedup = false;
      }
      if (field === 'to') {
        cur.active = false;
        cur.speedup = false;
      }
      return { ...prev, [name]: cur };
    });
  };

  const cards = useMemo(() => {
    if (!data) return [];
    return buildingNames.map((name) => {
      const rows = data[name] || [];
      const levels = getBuildingLevels(rows, name);
      const s = bState[name] || {};
      const from = s.from ?? '';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from, to) : [];
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
      
      const availableBuildingSpeedups = getAvailableSpeedups(vault, 'building');
      const hasSpeedups = availableBuildingSpeedups > 0;
      const canUseSpeedup = hasSpeedups && buffedTime > 0 && steps.length > 0;
      
      let speedupResult = null;
      if (s.speedup && canUseSpeedup) {
        const otherLocked = {};
        speedupResult = calculateSpeedupUsage(buffedTime, vault, 'building', otherLocked);
        if (speedupResult.usedSpeedup > 0) {
          costs.building_speedup = (costs.building_speedup || 0) + speedupResult.usedSpeedup;
          points += speedupResult.totalPoints;
        }
      }
      
      const { canAfford } = computeAffordability(costs, vault);
      const hasSelection = !!to && steps.length > 0;
      const levelsArray = levels || [];
      const maxLevel = levelsArray.length ? levelsArray[levelsArray.length - 1] : '';
      const isMaxed = from && maxLevel && convertLevelToNumeric(from) === convertLevelToNumeric(maxLevel);
      const canUpgrade = canAfford && hasSelection && !isMaxed;
      const canSpeedup = canUseSpeedup && canAfford && hasSelection && !isMaxed;

      return {
        name, levels, s, from, to, steps, costs, points,
        totalTime, buffedTime, speedupMins, canAfford,
        hasSelection, isMaxed, canUpgrade, canSpeedup, hasSpeedups,
        availableBuildingSpeedups, speedupResult, maxLevel,
      };
    });
  }, [data, buildingNames, bState, buffs, vault]);

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const c of cards) {
      if (c.s.active && c.canAfford && c.steps.length) total += c.points;
    }
    return total;
  }, [cards]);

  // Only update score when it actually changes
  useEffect(() => {
    if (prevScoreRef.current !== totalActivePoints) {
      prevScoreRef.current = totalActivePoints;
      setPageScore('buildings', totalActivePoints);
    }
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
                highest={c.maxLevel}
              />
              <div className="checkbox-group">
                <label className="checkbox-label" style={{ opacity: c.canUpgrade ? 1 : 0.5 }}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={!!c.s.active && c.canAfford}
                    disabled={!c.canUpgrade}
                    onChange={(e) => setField(c.name, 'active', e.target.checked)}
                  />
                  Upgrade
                </label>
                <label className="checkbox-label" style={{ opacity: c.canSpeedup ? 1 : 0.5 }}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={!!c.s.speedup && c.canSpeedup}
                    disabled={!c.canSpeedup}
                    onChange={(e) => setField(c.name, 'speedup', e.target.checked)}
                  />
                  <AssetImg src={resourceImg('building_speedup')} size={18} /> +Speedups
                  {!c.hasSpeedups && c.steps.length > 0 && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                      (no building speedups)
                    </span>
                  )}
                </label>
              </div>
              <CostStatus
                active={!!c.s.active && c.canAfford}
                hasSelection={c.hasSelection}
                points={c.points}
                stepsInfo={` (${c.steps.length} steps)`}
                costs={c.costs}
                vault={vault}
                extra={
                  c.hasSelection ? (
                    <div>
                      <AssetImg src={resourceImg('building_speedup')} size={18} /> Time: {formatSecondsToTime(c.buffedTime)}
                      {c.buffedTime !== c.totalTime && (
                        <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(c.totalTime)})</span>
                      )}
                      {c.s.speedup && c.canSpeedup && c.speedupResult && (
                        <div>
                          <AssetImg src={resourceImg('building_speedup')} size={18} /> Speedup: {formatSecondsToTime(c.speedupResult.usedSpeedup * 60)}
                          {c.speedupResult.partialNote && (
                            <span style={{ color: 'var(--color-warning)', fontSize: '0.65rem', display: 'block' }}>
                              {c.speedupResult.partialNote}
                            </span>
                          )}
                        </div>
                      )}
                      {c.s.speedup && !c.canSpeedup && c.hasSelection && (
                        <div style={{ color: 'var(--color-warning)', fontSize: '0.65rem' }}>
                          <AssetImg src={resourceImg('building_speedup')} size={18} /> No building speedups available in vault
                        </div>
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