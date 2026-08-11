import { sequentialAfford, sumActiveCosts, computeAffordability } from '../utils/resources';
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
} from '../utils/calc';
import { TrainingBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { LevelSelects } from '../components/LevelSelects';
import { troopImg, resourceImg } from '../utils/images';

const TYPES = ['Infantry', 'Cavalry', 'Archer'];

export default function TroopsPage() {
  const { data, loading, error } = useGameData('troops');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
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
          let points = (row.point || SCORE_RULES.troops[level] || 0) * qty;
          const timeSec = parseTimeToSeconds(row.time) * qty;
          if (t.speedup && timeSec > 0) {
            const mins = Math.ceil(timeSec / 60);
            costs.training_speedup = (costs.training_speedup || 0) + mins;
            points += mins * SCORE_RULES.speedup_min;
          }
          out.cards[tKey] = {
            costs,
            points,
            timeSec,
            label: `${type} T${level} ×${qty}`,
            active: !!t.active,
          };
          out.order.push(tKey);
        }
      }

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
          if (p.speedup && timeSec > 0) {
            const mins = Math.ceil(timeSec / 60);
            costs.training_speedup = (costs.training_speedup || 0) + mins;
            points += mins * (SCORE_RULES.speedup_min || 0);
          }
          out.cards[pKey] = {
            costs,
            points,
            timeSec,
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
    }));
    const afford = sequentialAfford(seqItems, vault);
    for (const id of out.order) {
      const a = afford.get(id) || { canAfford: true, vaultBefore: vault };
      out.cards[id].canAfford = a.canAfford;
      out.cards[id].vaultBefore = a.vaultBefore;
      if (out.cards[id].active && a.canAfford) {
        out.totalPoints += out.cards[id].points;
        for (const [k, v] of Object.entries(out.cards[id].costs || {})) {
          out.totalCosts[k] = (out.totalCosts[k] || 0) + v;
        }
      }
    }
    return out;
  }, [data, troopsState, training, promoting, vault]);

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

  useEffect(() => {
    setPageScore('troops', results.totalPoints);
  }, [results.totalPoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading troops…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="calculator-page">
      <h2>Troops</h2>
      <p className="hint">Training & promotion costs/points. Toggle Active to lock into score. Saved to MongoDB.</p>

      <TrainingBuffPanel />
      <div className="section-title">Training</div>
      <div className="cards-grid">
        {TYPES.map((type) => {
          const key = `train_${type}`;
          const s = troopsState[key] || {};
          const levels = (training[type] || []).map((r) => r.lvl);
          const card = results.cards[key];
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
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!s.active}
                      onChange={(e) => setField(key, 'active', e.target.checked)}
                    />{' '}
                    Active
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!s.speedup}
                      onChange={(e) => setField(key, 'speedup', e.target.checked)}
                    />{' '}
                    +Speedups
                  </label>
                </div>
                <div className="status-pane">
                  {card ? (
                    <>
                      <div><strong>{s.active ? 'ACTIVE' : 'ESTIMATED'}</strong> Points: {formatNumber(card.points)}</div>
                      <div>Time: {formatSecondsToTime(applyTrainingSpeedupBuffs(card.timeSec, trainBuffs))}
                        {applyTrainingSpeedupBuffs(card.timeSec, trainBuffs) !== card.timeSec && (
                          <span style={{ opacity: 0.7 }}> (base {formatSecondsToTime(card.timeSec)})</span>
                        )}
                      </div>
                      {s.speedup && (
                        <div>Speedup: {formatNumber(secondsToSpeedupMinutes(applyTrainingSpeedupBuffs(card.timeSec, trainBuffs)))} min</div>
                      )}
                      {Object.entries(card.costs).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AssetImg src={resourceImg(k)} size={18} />
                          <span>{k.replace(/_/g, ' ')}: {formatNumber(v)}</span>
                          {(() => {
                            const vlt = card.vaultBefore || vault;
                            const left = parseCost(vlt?.[k]) - parseCost(v);
                            return (
                              <span className={left >= 0 ? 'text-remaining' : 'text-deficit'}>
                                {' '}({formatNumber(Math.abs(left))} {left >= 0 ? 'left' : 'short'})
                              </span>
                            );
                          })()}

                        </div>
                      ))}
                    </>
                  ) : (
                    'Select tier & quantity'
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">Promotion</div>
      <div className="cards-grid">
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
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!s.active}
                      onChange={(e) => setField(key, 'active', e.target.checked)}
                    />{' '}
                    Active
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!s.speedup}
                      onChange={(e) => setField(key, 'speedup', e.target.checked)}
                    />{' '}
                    +Speedups
                  </label>
                </div>
                <div className="status-pane">
                  {card ? (
                    <>
                      <div>Points: {formatNumber(card.points)}</div>
                      <div>Time: {formatSecondsToTime(card.timeSec)}</div>
                      {Object.entries(card.costs).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AssetImg src={resourceImg(k)} size={18} />
                          <span>{k.replace(/_/g, ' ')}: {formatNumber(v)}</span></div>
                      ))}
                    </>
                  ) : (
                    'Select from → to & quantity'
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
