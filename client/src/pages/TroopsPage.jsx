import { sequentialAfford, sumActiveCosts, computeAffordability } from '../utils/resources';
import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { useScoreRules } from '../hooks/useScoreRules';
import { usePublishPageScore } from '../hooks/usePublishPageScore';
import ShowMaxedToggle, { useShowMaxedItems } from '../components/ShowMaxedToggle';
import { parseCost, parseTimeToSeconds, formatNumber, formatSecondsToTime, applyTrainingSpeedupBuffs, secondsToSpeedupMinutes } from '../utils/calc';
import { TrainingBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import GroupCard from '../components/GroupCard';
import { LevelSelects } from '../components/LevelSelects';
import { troopImg, resourceImg } from '../utils/images';

const TYPES = ['Infantry', 'Cavalry', 'Archer'];

export default function TroopsPage() {
  const { data, loading, error } = useGameData('troops');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
  const { scoreRules: SCORE_RULES, eventId: activeEventId } = useScoreRules();
  const showMaxed = useShowMaxedItems();
  const vault = useMemo(
    () => remainingVaultExcluding('troops'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const troopsState = state.troops || {};
  const trainBuffs = state.settings?.trainingBuffs || {};

  const training = data?.Troops?.Training || {};
  const promoting = data?.Troops?.Promoting || {};

  const setField = (key, field, value) => {
    updateSection('troops', (prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  };

  const results = useMemo(() => {
    const out = { cards: {}, totalPoints: 0, totalCosts: {}, order: [] };
    if (!data) return out;

    // Order: all training first, then all promotions — so training_speedup is
    // spent on train cards before promos fall back to general_speedup.
    for (const type of TYPES) {
      const tKey = `train_${type}`;
      const t = troopsState[tKey] || {};
      const level = parseInt(t.level, 10) || 0;
      const qty = parseFloat(t.qty) || 0;
      if (level > 0 && qty > 0) {
        const row = (training[type] || []).find((r) => r.lvl === level || Number(r.lvl) === level);
        if (row) {
          const costs = {};
          for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
            if (row[k] != null) costs[k] = parseCost(row[k]) * qty;
          }
          let points = (SCORE_RULES.troops?.[level] ?? row.point ?? 0) * qty;
          const timeSec = parseTimeToSeconds(row.time) * qty;
          const buffedTrain = applyTrainingSpeedupBuffs(timeSec, trainBuffs);
          const speedupMins =
            t.speedup && buffedTrain > 0 ? Math.ceil(buffedTrain / 60) : 0;
          out.cards[tKey] = {
            costs,
            points,
            timeSec,
            speedupMins,
            speedupKey: 'training_speedup',
            label: `${type} T${level} ×${qty}`,
            active: !!t.active,
          };
          out.order.push(tKey);
        }
      }
    }
    for (const type of TYPES) {
      const pKey = `promo_${type}`;
      const p = troopsState[pKey] || {};
      const from = parseInt(p.from, 10) || 0;
      const to = parseInt(p.to, 10) || 0;
      const pQty = parseFloat(p.qty) || 0;
      if (from > 0 && to > from && pQty > 0) {
        const rows = promoting[type] || [];
        const chain = [];
        let cur = from;
        for (let guard = 0; guard < 20 && cur < to; guard++) {
          const row = rows.find((r) => Number(r.current_lvl) === cur);
          if (!row) break;
          chain.push(row);
          cur = Number(row.target_lvl);
          if (cur === to) break;
        }
        if (chain.length && Number(chain[chain.length - 1].target_lvl) === to) {
          const costs = {};
          let timeSec = 0;
          for (const row of chain) {
            for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
              if (row[k] != null) costs[k] = (costs[k] || 0) + parseCost(row[k]) * pQty;
            }
            timeSec += parseTimeToSeconds(row.time) * pQty;
          }
          let points =
            ((SCORE_RULES.troops?.[to] || 0) - (SCORE_RULES.troops?.[from] || 0)) * pQty;
          points = Math.max(0, points);
          const buffedTime = applyTrainingSpeedupBuffs(timeSec, trainBuffs);
          const speedupMins =
            p.speedup && buffedTime > 0 ? Math.ceil(buffedTime / 60) : 0;
          out.cards[pKey] = {
            costs,
            points,
            timeSec,
            buffedTime,
            speedupMins,
            speedupKey: 'training_speedup',
            label: `${type} T${from}→T${to} ×${pQty} (${chain.length} steps)`,
            active: !!p.active,
          };
          out.order.push(pKey);
        }
      }
    }

    const seqItems = out.order.map((id) => ({
      id,
      costs: out.cards[id].costs,
      active: out.cards[id].active,
      speedupMins: out.cards[id].speedupMins || 0,
      speedupKey: out.cards[id].speedupKey,
    }));
    const afford = sequentialAfford(seqItems, vault);
    for (const id of out.order) {
      const a = afford.get(id) || { canAfford: true, vaultBefore: vault };
      const card = out.cards[id];
      const usedSpd = a.speedupAlloc?.used ?? 0;
      card.costs = a.resolvedCosts || card.costs;
      card.points =
        card.points + (usedSpd > 0 ? usedSpd * (SCORE_RULES.speedup_min ?? 0) : 0);
      card.canAfford = a.canAfford;
      card.vaultBefore = a.vaultBefore;
      card.speedupAlloc = a.speedupAlloc;
      if (card.active && a.canAfford) {
        out.totalPoints += card.points;
        for (const [k, v] of Object.entries(card.costs || {})) {
          out.totalCosts[k] = (out.totalCosts[k] || 0) + v;
        }
      }
    }
    return out;
  }, [data, troopsState, training, promoting, vault, trainBuffs, SCORE_RULES, activeEventId]);

  useEffect(() => {
    const items = (results.order || []).map((id) => ({
      id,
      costs: results.cards[id]?.costs || {},
      active: !!results.cards[id]?.active,
    }));
    const map = new Map(
      (results.order || []).map((id) => [id, { canAfford: !!results.cards[id]?.canAfford }])
    );
    setPageLockedCosts('troops', sumActiveCosts(items, map));
  }, [results, setPageLockedCosts]);

  usePublishPageScore('troops', results.totalPoints);

  const hasMaxedItems = useMemo(() => {
    const training = data?.Training || data?.training || {};
    for (const type of TYPES) {
      const levels = (training[type] || []).map((r) => Number(r.lvl));
      const maxTier = levels.length ? Math.max(...levels) : 11;
      const s = troopsState[`train_${type}`] || {};
      if (Number(s.level) === maxTier) return true;
    }
    return false;
  }, [data, troopsState]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading troops…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="calculator-page">
      <TrainingBuffPanel />
      <ShowMaxedToggle hasMaxed={hasMaxedItems} />
      <div className="group-columns group-columns-1">
      <GroupCard title="Training" iconSrc={troopImg('Infantry')} iconAlt="Training">
      <div className="cards-grid cards-grid-3">
        {TYPES.map((type) => {
          const key = `train_${type}`;
          const s = troopsState[key] || {};
          const levels = (training[type] || []).map((r) => r.lvl);
          const card = results.cards[key];
          const maxTier = levels.length ? Math.max(...levels.map(Number)) : 11;
          if (!showMaxed && Number(s.level) === maxTier && !s.active && !s.qty) return null;
          return (
            <div className="item-card" key={key}>
              <div className="item-card-header"><AssetImg src={troopImg(type)} size={40} /><span>{type}</span></div>
              <div className="item-card-body">
                <div className="level-controls">
                  <select
                    value={s.level || ''}
                    onChange={(e) => setField(key, 'level', e.target.value)}
                  >
                    <option value="" disabled hidden>Current Tier</option>
                    <option value="0">0</option>
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        Tier {l}{l === 11 ? ' (Max)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Qty" className="hero-shard-input"
                    value={s.qty || ''}
                    onChange={(e) => setField(key, 'qty', e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                </div>
                <div className="checkbox-group">
                  <label
                    className={`checkbox-label${!(card?.canAfford || !card || s.active) ? ' is-disabled' : ''}`}
                    style={{ opacity: (card?.canAfford ?? true) || !!s.active ? 1 : 0.42 }}
                  >
                    <input
                      className="checkbox" type="checkbox"
                      checked={!!s.active && !!card?.canAfford}
                      disabled={!card || (!card.canAfford && !s.active)}
                      onChange={(e) => setField(key, 'active', e.target.checked)}
                    />{' '}
                    Upgrade
                  </label>
                  <label className="checkbox-label">
                    <input
                      className="checkbox" type="checkbox"
                      checked={!!s.speedup}
                      onChange={(e) => setField(key, 'speedup', e.target.checked)}
                    />{' '}
                    +Speedups
                  </label>
                </div>
                <CostStatus
                  active={!!s.active && !!card?.canAfford}
                  hasSelection={!!card}
                  points={card?.points}
                  costs={card?.costs || {}}
                  vault={card?.vaultBefore || vault}
                  emptyHint="Select tier & quantity"
                  extra={card ? (
                    <div>
                      Time: {formatSecondsToTime(applyTrainingSpeedupBuffs(card.timeSec, trainBuffs))}
                      {applyTrainingSpeedupBuffs(card.timeSec, trainBuffs) !== card.timeSec && (
                        <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(card.timeSec)})</span>
                      )}
                    </div>
                  ) : null}
                />
              </div>
            </div>
          );
        })}
      </div>
      </GroupCard>
      </div>

      <div className="group-columns group-columns-1" style={{ marginTop: 16 }}>
      <GroupCard title="Promotion" iconSrc={troopImg('Cavalry')} iconAlt="Promotion">
      <div className="cards-grid cards-grid-3">
        {TYPES.map((type) => {
          const key = `promo_${type}`;
          const s = troopsState[key] || {};
          const rows = promoting[type] || [];
          const fromLevels = [...new Set(rows.map((r) => Number(r.current_lvl)))].sort((a, b) => a - b);
          const allTargets = [...new Set(rows.map((r) => Number(r.target_lvl)))].sort((a, b) => a - b);
          const fromN = s.from ? parseInt(s.from, 10) : 0;
          const toLevels = fromN
            ? allTargets.filter((t) => t > fromN)
            : allTargets;
          const card = results.cards[key];
          return (
            <div className="item-card" key={key}>
              <div className="item-card-header"><AssetImg src={troopImg(type)} size={40} /><span>{type} Promotion</span></div>
              <div className="item-card-body">
                <div className="level-controls">
                  <select
                    value={s.from || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setField(key, 'from', v);
                      const n = parseInt(v, 10);
                      const next = allTargets.find((t) => t > n);
                      setField(key, 'to', next != null ? String(next) : '');
                      setField(key, 'active', false);
                    }}
                  >
                    <option value="">From</option>
                    {fromLevels.map((l) => (
                      <option key={l} value={l}>Tier {l}</option>
                    ))}
                  </select>
                  <select
                    value={s.to || ''}
                    onChange={(e) => setField(key, 'to', e.target.value)}
                  >
                    <option value="">To</option>
                    {[...new Set(toLevels)].sort((a, b) => a - b).map((l) => (
                      <option key={l} value={l}>Tier {l}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Qty to promote" className="hero-shard-input"
                  value={s.qty || ''}
                  onChange={(e) => setField(key, 'qty', e.target.value.replace(/[^0-9.]/g, ''))}
                  style={{ width: '100%', marginTop: 8, textAlign: 'center' }}
                />
                {toLevels.length > 0 ? (
                <div className="checkbox-group">
                  <label
                    className={`checkbox-label${!(card?.canAfford || !card || s.active) ? ' is-disabled' : ''}`}
                    style={{ opacity: (card?.canAfford ?? true) || !!s.active ? 1 : 0.42 }}
                  >
                    <input
                      className="checkbox" type="checkbox"
                      checked={!!s.active && !!card?.canAfford}
                      disabled={!card || (!card.canAfford && !s.active)}
                      onChange={(e) => setField(key, 'active', e.target.checked)}
                    />{' '}
                    Upgrade
                  </label>
                  <label className="checkbox-label">
                    <input
                      className="checkbox" type="checkbox"
                      checked={!!s.speedup}
                      onChange={(e) => setField(key, 'speedup', e.target.checked)}
                    />{' '}
                    +Speedups
                  </label>
                </div>
                ) : null}
                <CostStatus
                  active={!!s.active && !!card?.canAfford}
                  hasSelection={!!card}
                  atMax={toLevels.length === 0 && !!s.from}
                  points={card?.points}
                  costs={card?.costs || {}}
                  vault={card?.vaultBefore || vault}
                  emptyHint="Select from → to & quantity"
                  extra={card ? (
                    <div>
                      Time: {formatSecondsToTime(card.buffedTime ?? applyTrainingSpeedupBuffs(card.timeSec, trainBuffs))}
                      {(card.buffedTime ?? applyTrainingSpeedupBuffs(card.timeSec, trainBuffs)) !== card.timeSec && (
                        <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(card.timeSec)})</span>
                      )}
                    </div>
                  ) : null}
                />
              </div>
            </div>
          );
        })}
      </div>
      </GroupCard>
      </div>
    </div>
  );
}
