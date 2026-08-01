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
import { LevelSelects } from '../components/LevelSelects';
import { troopImg } from '../utils/images';

const TYPES = ['Infantry', 'Cavalry', 'Archer'];

export default function TroopsPage() {
  const { data, loading, error } = useGameData('troops');
  const { state, updateSection, vault, setPageScore } = useApp();
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
    const out = { cards: {}, totalPoints: 0, totalCosts: {} };
    if (!data) return out;

    for (const type of TYPES) {
      // Training
      const tKey = `train_${type}`;
      const t = troopsState[tKey] || {};
      const level = parseInt(t.level, 10) || 0;
      const qty = parseFloat(t.qty) || 0;
      if (level > 0 && qty > 0) {
        const row = (training[type] || []).find((r) => r.lvl === level);
        if (row) {
          const costs = {};
          for (const k of ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold']) {
            if (row[k] != null) costs[k] = parseCost(row[k]) * qty;
          }
          const points = (row.point || SCORE_RULES.troops[level] || 0) * qty;
          const timeSec = parseTimeToSeconds(row.time) * qty;
          out.cards[tKey] = { costs, points, timeSec, label: `${type} T${level} ×${qty}` };
          if (t.active) {
            out.totalPoints += points;
            for (const [k, v] of Object.entries(costs)) {
              out.totalCosts[k] = (out.totalCosts[k] || 0) + v;
            }
            if (t.speedup && timeSec > 0) {
              const mins = Math.ceil(timeSec / 60);
              out.totalCosts.training_speedup = (out.totalCosts.training_speedup || 0) + mins;
              out.totalPoints += mins * SCORE_RULES.speedup_min;
            }
          }
        }
      }

      // Promotion — sum all steps from → to (e.g. 1→11)
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
          const points =
            ((SCORE_RULES.troops?.[to] || SCORE_RULES[`troop_${to}`] || 0) -
              (SCORE_RULES.troops?.[from] || SCORE_RULES[`troop_${from}`] || 0)) * pQty;
          out.cards[pKey] = {
            costs,
            points: Math.max(0, points),
            timeSec,
            label: `${type} T${from}→T${to} ×${pQty} (${chain.length} steps)`,
          };
          if (p.active) {
            out.totalPoints += Math.max(0, points);
            for (const [k, v] of Object.entries(costs)) {
              out.totalCosts[k] = (out.totalCosts[k] || 0) + v;
            }
            if (p.speedup && timeSec > 0) {
              const mins = Math.ceil(timeSec / 60);
              out.totalCosts.training_speedup = (out.totalCosts.training_speedup || 0) + mins;
              out.totalPoints += mins * (SCORE_RULES.speedup_min || 0);
            }
          }
        }
      }
    }
    return out;
  }, [data, troopsState, training, promoting]);

  // Push active points into global score (MongoDB) — same idea as original saveCurrentPageScore
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
                        <div key={k}>
                          {k}: {formatNumber(v)}
                          {vault?.[k] != null && (
                            <span className={parseCost(vault[k]) >= v ? 'text-remaining' : 'text-deficit'}>
                              {' '}({formatNumber(parseCost(vault[k]) - v)} left)
                            </span>
                          )}
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
                        <div key={k}>{k}: {formatNumber(v)}</div>
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
