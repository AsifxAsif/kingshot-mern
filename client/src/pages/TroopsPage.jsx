import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import {
  parseCost,
  parseTimeToSeconds,
  formatNumber,
  formatSecondsToTime,
  SCORE_RULES,
  applyTrainingSpeedupBuffs,
  secondsToSpeedupMinutes,
  getAvailableSpeedups,
  calculateSpeedupUsage,
} from '../utils/calc';
import { computeAffordability } from '../utils/resources';
import { TrainingBuffPanel } from '../components/BuffPanel';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { troopImg, resourceImg } from '../utils/images';

const TYPES = ['Infantry', 'Cavalry', 'Archer'];

function getTrainingPoints(level) {
  const map = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7, 6: 11, 7: 16, 8: 23, 9: 30, 10: 39, 11: 49 };
  return map[level] || 0;
}

function getPromotionSteps(promotingData, type, from, to) {
  const rows = promotingData[type] || [];
  const chain = [];
  let cur = from;
  const visited = new Set();
  for (let guard = 0; guard < 30 && cur < to && !visited.has(cur); guard++) {
    visited.add(cur);
    const row = rows.find((r) => Number(r.current_lvl) === cur);
    if (!row) break;
    chain.push(row);
    cur = Number(row.target_lvl);
    if (cur === to) break;
    if (cur > to) { chain.length = 0; break; }
  }
  if (chain.length && Number(chain[chain.length - 1].target_lvl) === to) {
    return chain;
  }
  return [];
}

export default function TroopsPage() {
  const { data, loading, error } = useGameData('troops');
  const { state, updateSection, vault, remainingVault, setPageScore } = useApp();
  const troopsState = state.troops || {};
  const trainBuffs = state.settings?.trainingBuffs || {};

  const training = data?.Troops?.Training || {};
  const promoting = data?.Troops?.Promoting || {};

  const setField = (key, field, value) => {
    updateSection('troops', (prev) => {
      const cur = { ...(prev[key] || {}), [field]: value };
      if (field === 'level' || field === 'from') {
        cur.active = false;
        cur.speedup = false;
      }
      if (field === 'to') {
        cur.active = false;
        cur.speedup = false;
      }
      if (field === 'qty') {
        cur.active = false;
        cur.speedup = false;
      }
      return { ...prev, [key]: cur };
    });
  };

  const trainingCards = useMemo(() => {
    const result = [];
    for (const type of TYPES) {
      const key = `train_${type}`;
      const s = troopsState[key] || {};
      const level = parseInt(s.level, 10) || 0;
      const qty = parseFloat(s.qty) || 0;
      const hasSelection = level > 0 && qty > 0;
      const levels = (training[type] || []).map((r) => r.lvl).sort((a, b) => a - b);
      
      let cardData = {
        type: 'training',
        troopType: type,
        key: key,
        s: s,
        level: level,
        qty: qty,
        hasSelection: hasSelection,
        levels: levels,
        costs: {},
        points: 0,
        timeSec: 0,
        buffedTime: 0,
        canAfford: true,
        canUpgrade: false,
        canSpeedup: false,
        hasSpeedups: false,
        speedupResult: null,
      };
      
      if (hasSelection) {
        const row = (training[type] || []).find((r) => r.lvl === level);
        if (row) {
          const costs = {};
          for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
            if (row[k] != null) costs[k] = parseCost(row[k]) * qty;
          }
          const points = (row.point || SCORE_RULES.troops[level] || 0) * qty;
          const timeSec = parseTimeToSeconds(row.time) * qty;
          const buffedTime = applyTrainingSpeedupBuffs(timeSec, trainBuffs);
          
          const availableSpeedups = getAvailableSpeedups(remainingVault, 'training');
          const hasSpeedups = availableSpeedups > 0;
          const canUseSpeedup = hasSpeedups && buffedTime > 0;
          
          let speedupResult = null;
          let finalPoints = points;
          const finalCosts = { ...costs };
          
          if (s.speedup && canUseSpeedup) {
            const otherLocked = {};
            speedupResult = calculateSpeedupUsage(buffedTime, remainingVault, 'training', otherLocked);
            if (speedupResult.totalUsed > 0) {
              if (speedupResult.usedTraining > 0) {
                finalCosts.training_speedup = (finalCosts.training_speedup || 0) + speedupResult.usedTraining;
              }
              if (speedupResult.usedGeneral > 0) {
                finalCosts.general_speedup = (finalCosts.general_speedup || 0) + speedupResult.usedGeneral;
              }
              finalPoints += speedupResult.totalPoints;
            }
          }
          
          const { canAfford } = computeAffordability(finalCosts, remainingVault);
          const canUpgrade = canAfford && hasSelection;
          const canSpeedup = canUseSpeedup && canAfford && hasSelection;
          
          cardData = {
            ...cardData,
            costs: finalCosts,
            points: finalPoints,
            timeSec: timeSec,
            buffedTime: buffedTime,
            canAfford: canAfford,
            canUpgrade: canUpgrade,
            canSpeedup: canSpeedup,
            hasSpeedups: hasSpeedups,
            speedupResult: speedupResult,
          };
        }
      }
      result.push(cardData);
    }
    return result;
  }, [troopsState, training, trainBuffs, remainingVault]);

  const promotionCards = useMemo(() => {
    const result = [];
    for (const type of TYPES) {
      const key = `promo_${type}`;
      const s = troopsState[key] || {};
      const from = parseInt(s.from, 10) || 0;
      const to = parseInt(s.to, 10) || 0;
      const qty = parseFloat(s.qty) || 0;
      const hasSelection = from > 0 && to > from && qty > 0;
      
      const rows = promoting[type] || [];
      const fromLevels = [...new Set(rows.map((r) => Number(r.current_lvl)))].sort((a, b) => a - b);
      const allTargets = [...new Set(rows.map((r) => Number(r.target_lvl)))].sort((a, b) => a - b);
      
      let cardData = {
        type: 'promotion',
        troopType: type,
        key: key,
        s: s,
        from: from,
        to: to,
        qty: qty,
        hasSelection: hasSelection,
        fromLevels: fromLevels,
        allTargets: allTargets,
        costs: {},
        points: 0,
        timeSec: 0,
        buffedTime: 0,
        canAfford: true,
        canUpgrade: false,
        canSpeedup: false,
        hasSpeedups: false,
        speedupResult: null,
      };
      
      if (hasSelection) {
        const chain = getPromotionSteps(promoting, type, from, to);
        if (chain.length) {
          const costs = {};
          let timeSec = 0;
          for (const row of chain) {
            for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
              if (row[k] != null) costs[k] = (costs[k] || 0) + parseCost(row[k]) * qty;
            }
            timeSec += parseTimeToSeconds(row.time) * qty;
          }
          const fromPoints = getTrainingPoints(from);
          const toPoints = getTrainingPoints(to);
          const points = (toPoints - fromPoints) * qty;
          const buffedTime = applyTrainingSpeedupBuffs(timeSec, trainBuffs);
          
          const availableSpeedups = getAvailableSpeedups(remainingVault, 'training');
          const hasSpeedups = availableSpeedups > 0;
          const canUseSpeedup = hasSpeedups && buffedTime > 0;
          
          let speedupResult = null;
          let finalPoints = Math.max(0, points);
          const finalCosts = { ...costs };
          
          if (s.speedup && canUseSpeedup) {
            const otherLocked = {};
            speedupResult = calculateSpeedupUsage(buffedTime, remainingVault, 'training', otherLocked);
            if (speedupResult.totalUsed > 0) {
              if (speedupResult.usedTraining > 0) {
                finalCosts.training_speedup = (finalCosts.training_speedup || 0) + speedupResult.usedTraining;
              }
              if (speedupResult.usedGeneral > 0) {
                finalCosts.general_speedup = (finalCosts.general_speedup || 0) + speedupResult.usedGeneral;
              }
              finalPoints += speedupResult.totalPoints;
            }
          }
          
          const { canAfford } = computeAffordability(finalCosts, remainingVault);
          const canUpgrade = canAfford && hasSelection;
          const canSpeedup = canUseSpeedup && canAfford && hasSelection;
          
          cardData = {
            ...cardData,
            costs: finalCosts,
            points: finalPoints,
            timeSec: timeSec,
            buffedTime: buffedTime,
            canAfford: canAfford,
            canUpgrade: canUpgrade,
            canSpeedup: canSpeedup,
            hasSpeedups: hasSpeedups,
            speedupResult: speedupResult,
          };
        }
      }
      result.push(cardData);
    }
    return result;
  }, [troopsState, promoting, trainBuffs, remainingVault]);

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const c of trainingCards) {
      if (c && c.s && c.s.active && c.canAfford && c.hasSelection) total += c.points;
    }
    for (const c of promotionCards) {
      if (c && c.s && c.s.active && c.canAfford && c.hasSelection) total += c.points;
    }
    return total;
  }, [trainingCards, promotionCards]);

  useEffect(() => {
    setPageScore('troops', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading troops…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      <TrainingBuffPanel />
      <div className="section-title">Training</div>
      <div className="items-grid cards-grid">
        {trainingCards.map((c) => {
          if (!c) return null;
          return (
            <div className="item-card" key={c.key}>
              <div className="item-card-header">
                <AssetImg src={troopImg(c.troopType)} size={40} />
                <span>{c.troopType}</span>
              </div>
              <div className="item-card-body">
                <div className="level-controls">
                  <select
                    value={c.s.level || ''}
                    onChange={(e) => setField(c.key, 'level', e.target.value)}
                  >
                    <option value="" disabled hidden>Current Tier</option>
                    <option value="0">0</option>
                    {c.levels.map((l) => (
                      <option key={l} value={l}>
                        Tier {l}{l === 11 ? ' (Max)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Quantity"
                    className="hero-shard-input"
                    style={{ textAlign: 'center' }}
                    value={c.s.qty || ''}
                    onChange={(e) => setField(c.key, 'qty', e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                </div>
                <div className="checkbox-group">
                  <label className="checkbox-label" style={{ opacity: c.canUpgrade ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={!!c.s.active && c.canAfford}
                      disabled={!c.canUpgrade}
                      onChange={(e) => setField(c.key, 'active', e.target.checked)}
                    />
                    Train Active
                  </label>
                  <label className="checkbox-label" style={{ opacity: c.canSpeedup ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={!!c.s.speedup && c.canSpeedup}
                      disabled={!c.canSpeedup}
                      onChange={(e) => setField(c.key, 'speedup', e.target.checked)}
                    />
                    <AssetImg src={resourceImg('training_speedup')} size={18} /> +Speedups
                    {!c.hasSpeedups && c.hasSelection && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                        (no speedups)
                      </span>
                    )}
                  </label>
                </div>
                <CostStatus
                  active={!!c.s.active && c.canAfford}
                  hasSelection={c.hasSelection}
                  points={c.points}
                  stepsInfo=""
                  costs={c.costs}
                  vault={remainingVault}
                  extra={
                    c.hasSelection ? (
                      <div>
                        <AssetImg src={resourceImg('training_speedup')} size={18} /> Time: {formatSecondsToTime(c.buffedTime)}
                        {c.buffedTime !== c.timeSec && (
                          <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(c.timeSec)})</span>
                        )}
                        {c.s.speedup && c.canSpeedup && c.speedupResult && (
                          <div>
                            <AssetImg src={resourceImg('training_speedup')} size={18} /> Speedup: {formatSecondsToTime(c.speedupResult.totalUsed * 60)}
                            {c.speedupResult.usedTraining > 0 && (
                              <span style={{ opacity: 0.7 }}> (training: {formatSecondsToTime(c.speedupResult.usedTraining * 60)})</span>
                            )}
                            {c.speedupResult.usedGeneral > 0 && (
                              <span style={{ opacity: 0.7 }}> (general: {formatSecondsToTime(c.speedupResult.usedGeneral * 60)})</span>
                            )}
                            {c.speedupResult.partialNote && (
                              <span style={{ color: 'var(--color-warning)', fontSize: '0.65rem', display: 'block' }}>
                                {c.speedupResult.partialNote}
                              </span>
                            )}
                          </div>
                        )}
                        {c.s.speedup && !c.canSpeedup && c.hasSelection && (
                          <div style={{ color: 'var(--color-warning)', fontSize: '0.65rem' }}>
                            <AssetImg src={resourceImg('training_speedup')} size={18} /> No speedups available in vault
                          </div>
                        )}
                      </div>
                    ) : null
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">Promotion</div>
      <div className="items-grid cards-grid">
        {promotionCards.map((c) => {
          if (!c) return null;
          const fromN = c.s.from ? parseInt(c.s.from, 10) : 0;
          const toLevels = fromN ? c.allTargets.filter((t) => t > fromN) : c.allTargets;

          const handleFromChange = (val) => {
            const v = parseInt(val, 10);
            setField(c.key, 'from', val);
            const next = c.allTargets.find((t) => t > v);
            setField(c.key, 'to', next != null ? String(next) : '');
          };

          return (
            <div className="item-card" key={c.key}>
              <div className="item-card-header">
                <AssetImg src={troopImg(c.troopType)} size={40} />
                <span>{c.troopType} Promotion</span>
              </div>
              <div className="item-card-body">
                <div className="level-controls">
                  <select
                    value={c.s.from || ''}
                    onChange={(e) => handleFromChange(e.target.value)}
                  >
                    <option value="" disabled hidden>Current Tier</option>
                    {c.fromLevels.map((l) => (
                      <option key={l} value={l}>Tier {l}</option>
                    ))}
                  </select>
                  <select
                    value={c.s.to || ''}
                    onChange={(e) => setField(c.key, 'to', e.target.value)}
                  >
                    <option value="" disabled hidden>Target Tier</option>
                    {toLevels.map((l) => (
                      <option key={l} value={l}>Tier {l}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Quantity to promote"
                  className="hero-shard-input"
                  style={{ textAlign: 'center', width: '100%', marginTop: 8 }}
                  value={c.s.qty || ''}
                  onChange={(e) => setField(c.key, 'qty', e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <div className="checkbox-group">
                  <label className="checkbox-label" style={{ opacity: c.canUpgrade ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={!!c.s.active && c.canAfford}
                      disabled={!c.canUpgrade}
                      onChange={(e) => setField(c.key, 'active', e.target.checked)}
                    />
                    Promote Active
                  </label>
                  <label className="checkbox-label" style={{ opacity: c.canSpeedup ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={!!c.s.speedup && c.canSpeedup}
                      disabled={!c.canSpeedup}
                      onChange={(e) => setField(c.key, 'speedup', e.target.checked)}
                    />
                    <AssetImg src={resourceImg('training_speedup')} size={18} /> +Speedups
                    {!c.hasSpeedups && c.hasSelection && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                        (no speedups)
                      </span>
                    )}
                  </label>
                </div>
                <CostStatus
                  active={!!c.s.active && c.canAfford}
                  hasSelection={c.hasSelection}
                  points={c.points}
                  stepsInfo=""
                  costs={c.costs}
                  vault={remainingVault}
                  extra={
                    c.hasSelection ? (
                      <div>
                        <AssetImg src={resourceImg('training_speedup')} size={18} /> Time: {formatSecondsToTime(c.buffedTime)}
                        {c.buffedTime !== c.timeSec && (
                          <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(c.timeSec)})</span>
                        )}
                        {c.s.speedup && c.canSpeedup && c.speedupResult && (
                          <div>
                            <AssetImg src={resourceImg('training_speedup')} size={18} /> Speedup: {formatSecondsToTime(c.speedupResult.totalUsed * 60)}
                            {c.speedupResult.usedTraining > 0 && (
                              <span style={{ opacity: 0.7 }}> (training: {formatSecondsToTime(c.speedupResult.usedTraining * 60)})</span>
                            )}
                            {c.speedupResult.usedGeneral > 0 && (
                              <span style={{ opacity: 0.7 }}> (general: {formatSecondsToTime(c.speedupResult.usedGeneral * 60)})</span>
                            )}
                            {c.speedupResult.partialNote && (
                              <span style={{ color: 'var(--color-warning)', fontSize: '0.65rem', display: 'block' }}>
                                {c.speedupResult.partialNote}
                              </span>
                            )}
                          </div>
                        )}
                        {c.s.speedup && !c.canSpeedup && c.hasSelection && (
                          <div style={{ color: 'var(--color-warning)', fontSize: '0.65rem' }}>
                            <AssetImg src={resourceImg('training_speedup')} size={18} /> No speedups available in vault
                          </div>
                        )}
                      </div>
                    ) : null
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}