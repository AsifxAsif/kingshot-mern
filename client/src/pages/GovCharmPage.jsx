import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, SCORE_RULES } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import {asset, resourceImg} from '../utils/images';

const CHARM_GROUPS = [
  { name: 'Helmet', type: 'cavalry' },
  { name: 'Watch', type: 'cavalry' },
  { name: 'Armor', type: 'infantry' },
  { name: 'Pant', type: 'infantry' },
  { name: 'Belt', type: 'archery' },
  { name: 'Weapon', type: 'archery' },
];

function charmImg(type, levelName) {
  let level = '1';
  if (levelName) {
    const s = String(levelName).trim();
    if (s && s !== '0') {
      const m = s.match(/Level\s*(\d+)/i) || s.match(/(\d+)/);
      if (m) level = m[1];
    }
  }
  return asset(`gov_charms/${type}_lvl${level}.webp`);
}

function buildOrder(rows) {
  const order = { '0': 0, '': 0 };
  let i = 1;
  const seen = new Set();
  for (const item of rows) {
    const t = item.target;
    if (t != null && !seen.has(String(t))) {
      seen.add(String(t));
      order[String(t)] = i++;
    }
  }
  return order;
}

function getSteps(rows, from, to, order) {
  const fromO = order[String(from ?? '0')] ?? 0;
  const toO = order[String(to)] ?? -1;
  if (toO <= fromO) return [];
  return rows.filter((item) => {
    const t = item.target != null ? String(item.target) : null;
    if (!t) return false;
    const o = order[t] ?? -1;
    return o > fromO && o <= toO;
  });
}

function nextLvl(levels, from, order) {
  const fromO = order[String(from ?? '0')] ?? 0;
  for (const l of levels) {
    if ((order[l] ?? 0) > fromO) return l;
  }
  return '';
}

export default function GovCharmPage() {
  const { data, loading, error } = useGameData('gov_charms');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('govCharm'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const cState = state.govCharm || {};
  const rows = data?.['GOV Charm'] || [];
  const order = useMemo(() => buildOrder(rows), [rows]);
  const levels = useMemo(() => {
    const set = new Set(['0']);
    for (const r of rows) {
      if (r.current != null) set.add(String(r.current));
      if (r.target != null) set.add(String(r.target));
    }
    return Array.from(set).sort((a, b) => (order[a] ?? 0) - (order[b] ?? 0));
  }, [rows, order]);

  const setPiece = (piece, field, value) => {
    updateSection('govCharm', (prev) => {
      const cur = { ...(prev[piece] || {}), [field]: value };
      if (field === 'from') {
        const next = nextLvl(levels, value, order);
        if (next) cur.to = next;
        cur.active = false;
      }
      if (field === 'to') cur.active = false;
      return { ...prev, [piece]: cur };
    });
  };

  const cards = useMemo(() => {
    const raw = CHARM_GROUPS.map((g) => {
      const s = cState[g.name] || {};
      const from = s.from ?? '0';
      const to = s.to || '';
      const steps = to ? getSteps(rows, from, to, order) : [];
      let points = 0;
      const costs = {};
      for (const step of steps) {
        points += parseCost(step.point) * (SCORE_RULES.gov_charm_score || 1);
        if (step.guides) costs.charm_guide = (costs.charm_guide || 0) + parseCost(step.guides);
        if (step.designs) costs.charm_design = (costs.charm_design || 0) + parseCost(step.designs);
      }
      return { ...g, id: g.name, s, from, to, steps, points, costs, active: !!s.active };
    });
    const afford = sequentialAfford(
      raw.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      vault
    );
    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      return { ...c, canAfford: a.canAfford, vaultBefore: a.vaultBefore };
    });
  }, [cState, rows, order, vault]);

  const totalPoints = useMemo(() => {
    let t = 0;
    for (const c of cards) {
      if (c.active && c.canAfford) t += c.points;
    }
    return t;
  }, [cards]);

  useEffect(() => {
    setPageLockedCosts(
      'govCharm',
      sumActiveCosts(
        cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
        new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
      )
    );
  }, [cards, setPageLockedCosts]);

  useEffect(() => { setPageScore('govCharm', totalPoints); }, [totalPoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      <div className="items-grid cards-grid">
        {cards.map((c) => (
          <div className="item-card" key={c.name}>
            <div className="item-card-header" style={{ justifyContent: 'space-evenly' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.65rem', color: '#888' }}>Current</span>
                <AssetImg src={charmImg(c.type, c.from === '0' ? 'Level 1' : c.from)} size={48} />
              </div>
              <span style={{ fontWeight: 700 }}>{c.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.65rem', color: '#888' }}>Target</span>
                <AssetImg src={charmImg(c.type, c.to || 'Level 1')} size={48} />
              </div>
            </div>
            <div className="item-card-body">
              <LevelSelects
                levels={levels}
                from={c.from ?? ''}
                to={c.to ?? ''}
                onFrom={(v) => setPiece(c.name, 'from', v)}
                onTo={(v) => setPiece(c.name, 'to', v)}
              />
              <label className="checkbox-label" style={{ opacity: c.canAfford || !c.to ? 1 : 0.5 }}>
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={!!c.active && c.canAfford}
                  disabled={!c.to || !c.canAfford}
                  onChange={(e) => setPiece(c.name, 'active', e.target.checked)}
                />{' '}
                Upgrade
              </label>
              <CostStatus
                active={!!c.active && c.canAfford}
                hasSelection={!!c.to}
                points={c.points}
                stepsInfo={` (${c.steps.length} steps)`}
                costs={c.costs}
                vault={c.vaultBefore || vault}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
