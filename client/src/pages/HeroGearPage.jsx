import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, SCORE_RULES, sortLevels } from '../utils/calc';
import { computeAffordability } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { asset } from '../utils/images';
import { LevelSelects } from '../components/LevelSelects';

export default function HeroGearPage() {
  const { data, loading, error } = useGameData('hero_gears');
  const { data: forgeData, loading: forgeLoading } = useGameData('forgehammers');
  const { state, updateSection, setPageScore, vault, remainingVault } = useApp();
  const s = state.heroGear || {};
  const rows = data?.['Hero Gear'] || (Array.isArray(data) ? data : []);
  const forgeRows = forgeData?.Mastery || forgeData?.Forgehammer || (Array.isArray(forgeData) ? forgeData : []);

  const levels = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      if (r.current_lvl !== undefined && r.current_lvl !== null) set.add(Number(r.current_lvl));
      if (r.target_lvl !== undefined && r.target_lvl !== null) set.add(Number(r.target_lvl));
    }
    if (set.size <= 1) {
      for (let i = 0; i <= 100; i++) set.add(i);
    }
    const result = sortLevels(Array.from(set));
    return result.length ? result : [0, 1, 2, 3, 4, 5];
  }, [rows]);

  const forgeLevels = useMemo(() => {
    const set = new Set();
    for (const r of forgeRows) {
      if (r.current_lvl !== undefined && r.current_lvl !== null) set.add(Number(r.current_lvl));
      if (r.target_lvl !== undefined && r.target_lvl !== null) set.add(Number(r.target_lvl));
    }
    if (set.size <= 1) {
      for (let i = 0; i <= 20; i++) set.add(i);
    }
    const result = sortLevels(Array.from(set));
    return result.length ? result : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  }, [forgeRows]);

  const setField = (field, value) => {
    updateSection('heroGear', (prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'from') {
        const fromN = Number(value);
        const higher = levels.filter((l) => l > fromN);
        next.to = higher.length ? String(higher[0]) : '';
        next.active = false;
      }
      if (field === 'to') next.active = false;
      if (field === 'forgeFrom') {
        const fromN = Number(value);
        const higher = forgeLevels.filter((l) => l > fromN);
        next.forgeTo = higher.length ? String(higher[0]) : '';
        next.forgeActive = false;
      }
      if (field === 'forgeTo') next.forgeActive = false;
      return next;
    });
  };

  const from = s.from !== undefined && s.from !== '' ? String(s.from) : '';
  const to = s.to !== undefined && s.to !== '' ? String(s.to) : '';
  const forgeFrom = s.forgeFrom !== undefined && s.forgeFrom !== '' ? String(s.forgeFrom) : '';
  const forgeTo = s.forgeTo !== undefined && s.forgeTo !== '' ? String(s.forgeTo) : '';
  const fromN = from === '' ? null : Number(from);
  const toN = to === '' ? null : Number(to);

  const displayImg =
    (toN != null && toN > 100) || (fromN != null && fromN > 100)
      ? asset('hero-gear-red.webp')
      : asset('hero-gear-mythic.webp');

  const steps = useMemo(() => {
    if (fromN == null || toN == null || toN <= fromN) return [];
    const result = [];
    let current = fromN;
    const visited = new Set();
    for (let guard = 0; guard < 300 && current < toN && !visited.has(current); guard++) {
      visited.add(current);
      const step = rows.find((r) => Number(r.current_lvl) === current);
      if (!step) break;
      result.push(step);
      current = Number(step.target_lvl);
      if (current === toN) break;
      if (current > toN) { result.length = 0; break; }
    }
    return result;
  }, [rows, fromN, toN]);

  const costs = useMemo(() => {
    const c = {};
    for (const step of steps) {
      for (const [k, v] of Object.entries(step)) {
        if (['current_lvl', 'target_lvl', 'level', 'time'].includes(k)) continue;
        const n = parseCost(v);
        if (n) c[k === 'forgehammer' ? 'forge_hammer' : k] = (c[k === 'forgehammer' ? 'forge_hammer' : k] || 0) + n;
      }
    }
    return c;
  }, [steps]);

  const points = useMemo(() => {
    let p = 0;
    for (const [k, v] of Object.entries(costs)) {
      if (SCORE_RULES[k]) p += v * SCORE_RULES[k];
    }
    return p;
  }, [costs]);

  const { canAfford } = useMemo(() => computeAffordability(costs, remainingVault || {}), [costs, remainingVault]);

  const forgeSteps = useMemo(() => {
    const ff = forgeFrom === '' ? null : Number(forgeFrom);
    const ft = forgeTo === '' ? null : Number(forgeTo);
    if (ff == null || ft == null || ft <= ff) return [];
    const result = [];
    let current = ff;
    const visited = new Set();
    for (let guard = 0; guard < 300 && current < ft && !visited.has(current); guard++) {
      visited.add(current);
      const step = forgeRows.find((r) => Number(r.current_lvl) === current);
      if (!step) break;
      result.push(step);
      current = Number(step.target_lvl);
      if (current === ft) break;
      if (current > ft) { result.length = 0; break; }
    }
    return result;
  }, [forgeRows, forgeFrom, forgeTo]);

  const forgeCosts = useMemo(() => {
    const c = {};
    for (const step of forgeSteps) {
      for (const [k, v] of Object.entries(step)) {
        if (['current_lvl', 'target_lvl', 'level', 'time'].includes(k)) continue;
        const n = parseCost(v);
        if (n) c[k] = (c[k] || 0) + n;
      }
    }
    return c;
  }, [forgeSteps]);

  const forgePoints = useMemo(() => {
    let p = 0;
    for (const [k, v] of Object.entries(forgeCosts)) {
      if (SCORE_RULES[k]) p += v * SCORE_RULES[k];
    }
    return p;
  }, [forgeCosts]);

  const forgeAfford = useMemo(
    () => computeAffordability(forgeCosts, remainingVault || {}).canAfford,
    [forgeCosts, remainingVault]
  );

  const total = (s.active && canAfford ? points : 0) + (s.forgeActive && forgeAfford ? forgePoints : 0);
  useEffect(() => {
    setPageScore('heroGear', total);
  }, [total, setPageScore]);

  if (loading || forgeLoading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }
  if (error) return <div className="page-error"><p>{error}</p></div>;

  const hasGearSelection = !!to && steps.length > 0;
  const isGearMaxed = fromN != null && fromN === levels[levels.length - 1];

  return (
    <div className="app-container">
      <div className="item-card">
        <div className="item-card-header">
          <AssetImg src={displayImg} size={50} key={displayImg} />
          <span>Hero Gear Mastery</span>
        </div>
        <div className="item-card-body">
          <LevelSelects
            levels={levels}
            from={from}
            to={to}
            onFrom={(v) => setField('from', v)}
            onTo={(v) => setField('to', v)}
            highest={levels[levels.length - 1]}
          />
          <div className="checkbox-group">
            <label className="checkbox-label" style={{ opacity: canAfford && hasGearSelection && !isGearMaxed ? 1 : 0.5 }}>
              <input
                className="checkbox"
                type="checkbox"
                checked={!!s.active && canAfford}
                disabled={!hasGearSelection || !canAfford || isGearMaxed}
                onChange={(e) => setField('active', e.target.checked)}
              />
              Upgrade
            </label>
          </div>
          <CostStatus
            active={!!s.active && canAfford}
            hasSelection={hasGearSelection}
            points={points}
            stepsInfo={` (${steps.length} steps)`}
            costs={costs}
            vault={remainingVault}
          />
        </div>
      </div>

      <div className="item-card" style={{ marginTop: 16 }}>
        <div className="item-card-header">
          <AssetImg src={asset('forge_hammer.webp')} size={50} />
          <span>Forgehammers Mastery</span>
        </div>
        <div className="item-card-body">
          <LevelSelects
            levels={forgeLevels}
            from={forgeFrom}
            to={forgeTo}
            onFrom={(v) => setField('forgeFrom', v)}
            onTo={(v) => setField('forgeTo', v)}
            highest={forgeLevels[forgeLevels.length - 1]}
          />
          <div className="checkbox-group">
            <label className="checkbox-label" style={{ opacity: forgeAfford && forgeTo ? 1 : 0.5 }}>
              <input
                className="checkbox"
                type="checkbox"
                checked={!!s.forgeActive && forgeAfford}
                disabled={!forgeTo || !forgeAfford}
                onChange={(e) => setField('forgeActive', e.target.checked)}
              />
              Upgrade
            </label>
          </div>
          <CostStatus
            active={!!s.forgeActive && forgeAfford}
            hasSelection={!!forgeTo && forgeSteps.length > 0}
            points={forgePoints}
            stepsInfo={` (${forgeSteps.length} steps)`}
            costs={forgeCosts}
            vault={remainingVault}
          />
        </div>
      </div>
    </div>
  );
}