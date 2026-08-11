import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, SCORE_RULES } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import {asset, resourceImg} from '../utils/images';
import { LevelSelects } from '../components/LevelSelects';

export default function HeroGearPage() {
  const { data, loading, error } = useGameData('hero_gears');
  const { data: forgeData, loading: forgeLoading } = useGameData('forgehammers');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('heroGear'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const s = state.heroGear || {};
  const rows = data?.['Hero Gear'] || (Array.isArray(data) ? data : []);
  const forgeRows = forgeData?.Mastery || forgeData?.Forgehammer || (Array.isArray(forgeData) ? forgeData : []);

  const levels = useMemo(() => {
    const set = new Set([0]);
    for (const r of rows) {
      if (r.current_lvl != null) set.add(Number(r.current_lvl));
      if (r.target_lvl != null) set.add(Number(r.target_lvl));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const forgeLevels = useMemo(() => {
    const set = new Set([0]);
    for (const r of forgeRows) {
      if (r.current_lvl != null) set.add(Number(r.current_lvl));
      if (r.target_lvl != null) set.add(Number(r.target_lvl));
    }
    if (set.size <= 1) for (let i = 0; i <= 20; i++) set.add(i);
    return Array.from(set).sort((a, b) => a - b);
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

  const from = s.from ?? '';
  const to = s.to ?? '';
  const forgeFrom = s.forgeFrom ?? '';
  const forgeTo = s.forgeTo ?? '';
  const fromN = from === '' ? null : Number(from);
  const toN = to === '' ? null : Number(to);

  // Image: >100 red, else mythic (original site)
  const gearImg =
    fromN != null && fromN > 100
      ? asset('hero-gear-red.webp')
      : asset('hero-gear-mythic.webp');
  // also react to target > 100
  const displayImg =
    (toN != null && toN > 100) || (fromN != null && fromN > 100)
      ? asset('hero-gear-red.webp')
      : asset('hero-gear-mythic.webp');

  const steps = useMemo(() => {
    if (fromN == null || toN == null || toN <= fromN) return [];
    return rows.filter((r) => {
      const c = Number(r.current_lvl);
      const t = Number(r.target_lvl);
      return c >= fromN && t <= toN && t > fromN;
    });
  }, [rows, fromN, toN]);

  const costs = useMemo(() => {
    const c = {};
    for (const step of steps) {
      for (const [k, v] of Object.entries(step)) {
        if (['current_lvl', 'target_lvl', 'level', 'time'].includes(k)) continue;
        const n = parseCost(v);
        if (!n) continue;
        // xp → hero_xp, forgehammer → forge_hammer (canonical vault keys)
        let key = k;
        if (k === 'xp' || k === 'exp') key = 'hero_xp';
        else if (k === 'forgehammer' || k === 'forge_hammers') key = 'forge_hammer';
        c[key] = (c[key] || 0) + n;
      }
    }
    return c;
  }, [steps]);

  const points = useMemo(() => {
    let p = 0;
    for (const [k, v] of Object.entries(costs)) {
      if (SCORE_RULES[k]) p += v * SCORE_RULES[k];
      // hero XP often has no score multiplier in rules
    }
    return p;
  }, [costs]);

  // forge hammer card
  const forgeSteps = useMemo(() => {
    const ff = forgeFrom === '' ? null : Number(forgeFrom);
    const ft = forgeTo === '' ? null : Number(forgeTo);
    if (ff == null || ft == null || ft <= ff) return [];
    return forgeRows.filter((r) => {
      const c = Number(r.current_lvl);
      const t = Number(r.target_lvl);
      return c >= ff && t <= ft && t > ff;
    });
  }, [forgeRows, forgeFrom, forgeTo]);

  const forgeCosts = useMemo(() => {
    const c = {};
    for (const step of forgeSteps) {
      for (const [k, v] of Object.entries(step)) {
        if (['current_lvl', 'target_lvl', 'level', 'time'].includes(k)) continue;
        const n = parseCost(v);
        if (!n) continue;
        let key = k;
        if (k === 'forgehammer' || k === 'forge_hammers') key = 'forge_hammer';
        else if (k === 'xp' || k === 'exp') key = 'hero_xp';
        c[key] = (c[key] || 0) + n;
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

  // Sequential: gear first, then forge (same page resource reduction)
  const seq = useMemo(() => {
    return sequentialAfford(
      [
        { id: 'gear', costs, active: !!s.active },
        { id: 'forge', costs: forgeCosts, active: !!s.forgeActive },
      ],
      vault || {}
    );
  }, [costs, forgeCosts, s.active, s.forgeActive, vault]);

  const canAfford = seq.get('gear')?.canAfford ?? true;
  const forgeAfford = seq.get('forge')?.canAfford ?? true;
  const gearVault = seq.get('gear')?.vaultBefore || vault;
  const forgeVault = seq.get('forge')?.vaultBefore || vault;

  const total = (s.active && canAfford ? points : 0) + (s.forgeActive && forgeAfford ? forgePoints : 0);
  useEffect(() => {
    setPageLockedCosts(
      'heroGear',
      sumActiveCosts(
        [
          { id: 'gear', costs, active: !!s.active },
          { id: 'forge', costs: forgeCosts, active: !!s.forgeActive },
        ],
        seq
      )
    );
  }, [costs, forgeCosts, s.active, s.forgeActive, seq, setPageLockedCosts]);
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
            <label className="checkbox-label">
              <input
                className="checkbox"
                type="checkbox"
                checked={!!s.active && canAfford}
                disabled={!to || !canAfford || (fromN != null && fromN === levels[levels.length - 1])}
                onChange={(e) => setField('active', e.target.checked)}
              />{' '}
              Upgrade
            </label>
          </div>
          <CostStatus
            active={!!s.active && canAfford}
            hasSelection={!!to && steps.length > 0}
            points={points}
            stepsInfo={` (${steps.length} steps)`}
            costs={costs}
            vault={gearVault}
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
            <label className="checkbox-label">
              <input
                className="checkbox"
                type="checkbox"
                checked={!!s.forgeActive && forgeAfford}
                disabled={!forgeTo || !forgeAfford}
                onChange={(e) => setField('forgeActive', e.target.checked)}
              />{' '}
              Upgrade
            </label>
          </div>
          <CostStatus
            active={!!s.forgeActive && forgeAfford}
            hasSelection={!!forgeTo && forgeSteps.length > 0}
            points={forgePoints}
            stepsInfo={` (${forgeSteps.length} steps)`}
            costs={forgeCosts}
            vault={forgeVault}
          />
        </div>
      </div>
    </div>
  );
}
