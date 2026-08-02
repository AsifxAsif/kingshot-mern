import { useMemo, useEffect, useRef } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import {
  parseCost,
  formatNumber,
  getUpgradeSteps,
  getLevelsFromArray,
  SCORE_RULES,
  parseTimeToSeconds,
  formatSecondsToTime,
  applyResearchSpeedupBuffs,
  secondsToSpeedupMinutes,
  getAvailableSpeedups,
  calculateSpeedupUsage,
  convertLevelToNumeric,
} from '../utils/calc';
import { computeAffordability } from '../utils/resources';
import { ResearchBuffPanel } from '../components/BuffPanel';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { warAcademyImg, resourceImg } from '../utils/images';

const RES = ['bread', 'wood', 'stone', 'iron', 'truegold', 'truegold_dust', 'tempered_truegold'];

export default function WarAcademyPage() {
  const { data, loading, error } = useGameData('war_academy');
  const { state, updateSection, setPageScore, vault } = useApp();
  const wa = state.warAcademy || {};
  const buffs = state.settings?.researchBuffs || {};
  const prevScoreRef = useRef(0);

  const techNames = useMemo(() => {
    const root = data?.['War Academy'] || data || {};
    return Object.keys(root).filter((k) => Array.isArray(root[k]));
  }, [data]);

  const root = data?.['War Academy'] || data || {};

  const setField = (name, field, value) => {
    updateSection('warAcademy', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from') {
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
    const result = [];
    for (const name of techNames) {
      const rows = root[name] || [];
      const levels = getLevelsFromArray(rows);
      const s = wa[name] || {};
      const from = s.from ?? '';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from, to) : [];
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
      let points = dust * SCORE_RULES.truegold_dust;
      const buffedTime = applyResearchSpeedupBuffs(totalTime, buffs);
      const speedupMins = secondsToSpeedupMinutes(buffedTime);
      
      const availableResearchSpeedups = getAvailableSpeedups(vault, 'research');
      const hasSpeedups = availableResearchSpeedups > 0;
      const canUseSpeedup = hasSpeedups && buffedTime > 0 && steps.length > 0;
      
      let speedupResult = null;
      if (s.speedup && canUseSpeedup) {
        const otherLocked = {};
        speedupResult = calculateSpeedupUsage(buffedTime, vault, 'research', otherLocked);
        if (speedupResult.usedSpeedup > 0) {
          costs.research_speedup = (costs.research_speedup || 0) + speedupResult.usedSpeedup;
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

      result.push({
        name,
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
        canAfford,
        hasSelection,
        isMaxed,
        canUpgrade,
        canSpeedup,
        hasSpeedups,
        availableResearchSpeedups,
        speedupResult,
        maxLevel,
      });
    }
    return result;
  }, [techNames, root, wa, vault, buffs]);

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
      setPageScore('warAcademy', totalActivePoints);
    }
  }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      <ResearchBuffPanel />
      <div className="items-grid cards-grid">
        {cards.map((c) => (
          <div className="item-card" key={c.name}>
            <div className="item-card-header">
              <AssetImg src={warAcademyImg(c.name)} size={40} />
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
                    type="checkbox"
                    checked={!!c.s.active && c.canAfford}
                    disabled={!c.canUpgrade}
                    onChange={(e) => setField(c.name, 'active', e.target.checked)}
                  />
                  Upgrade
                </label>
                <label className="checkbox-label" style={{ opacity: c.canSpeedup ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={!!c.s.speedup && c.canSpeedup}
                    disabled={!c.canSpeedup}
                    onChange={(e) => setField(c.name, 'speedup', e.target.checked)}
                  />
                  <AssetImg src={resourceImg('research_speedup')} size={18} /> +Speedups
                  {!c.hasSpeedups && c.steps.length > 0 && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                      (no research speedups)
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
                      <AssetImg src={resourceImg('research_speedup')} size={18} /> Time: {formatSecondsToTime(c.buffedTime)}
                      {c.buffedTime !== c.totalTime && (
                        <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(c.totalTime)})</span>
                      )}
                      {c.s.speedup && c.canSpeedup && c.speedupResult && (
                        <div>
                          <AssetImg src={resourceImg('research_speedup')} size={18} /> Speedup: {formatSecondsToTime(c.speedupResult.usedSpeedup * 60)}
                          {c.speedupResult.partialNote && (
                            <span style={{ color: 'var(--color-warning)', fontSize: '0.65rem', display: 'block' }}>
                              {c.speedupResult.partialNote}
                            </span>
                          )}
                        </div>
                      )}
                      {c.s.speedup && !c.canSpeedup && c.hasSelection && (
                        <div style={{ color: 'var(--color-warning)', fontSize: '0.65rem' }}>
                          <AssetImg src={resourceImg('research_speedup')} size={18} /> No research speedups available in vault
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