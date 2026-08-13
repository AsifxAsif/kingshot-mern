import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, SCORE_RULES } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import GroupCard from '../components/GroupCard';
import { asset, troopImg } from '../utils/images';

const GEAR_PIECES = ['Helmet', 'Watch', 'Armor', 'Pant', 'Belt', 'Weapon'];
const GEAR_GROUPS = [
  { troop: 'Cavalry', pieces: ['Helmet', 'Watch'] },
  { troop: 'Infantry', pieces: ['Armor', 'Pant'] },
  { troop: 'Archer', pieces: ['Belt', 'Weapon'] },
];
const GEAR_PREFIX = {
  Helmet: 'cavalry_gear_1', Watch: 'cavalry_gear_2',
  Armor: 'infantry_gear_1', Pant: 'infantry_gear_2',
  Belt: 'archery_gear_1', Weapon: 'archery_gear_2',
};

function govGearImg(piece, levelName) {
  const prefix = GEAR_PREFIX[piece] || 'cavalry_gear_1';
  let color = 'green', tier = '0', stars = '0';
  if (levelName && String(levelName).trim() && String(levelName) !== '0') {
    const s = String(levelName);
    const lower = s.toLowerCase();
    if (lower.includes('green')) color = 'green';
    else if (lower.includes('blue')) color = 'blue';
    else if (lower.includes('purple')) color = 'purple';
    else if (lower.includes('gold')) color = 'gold';
    else if (lower.includes('red')) color = 'red';
    const tm = s.match(/T([0-9])/i);
    if (tm) tier = tm[1];
    stars = String((s.match(/⭐/g) || []).length);
  }
  return asset(`gov_gears/${prefix}_${color}_t${tier}_s${stars}.webp`);
}

function buildOrder(rows) {
  const order = { '0': 0, '': 0 };
  let i = 1;
  const seen = new Set();
  for (const item of rows) {
    const t = item.target;
    if (t != null && t !== 'null' && !seen.has(String(t))) {
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

export default function GovGearPage() {
  const { data, loading, error } = useGameData('gov_gears');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('govGear'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const gState = state.govGear || {};
  const rows = data?.['GOV Gear'] || [];
  const order = useMemo(() => buildOrder(rows), [rows]);
  const levels = useMemo(() => {
    const set = new Set(['0']);
    for (const r of rows) {
      if (r.current != null && r.current !== 'null') set.add(String(r.current));
      if (r.target != null && r.target !== 'null') set.add(String(r.target));
    }
    return Array.from(set).sort((a, b) => (order[a] ?? 0) - (order[b] ?? 0));
  }, [rows, order]);

  const setPiece = (piece, field, value) => {
    updateSection('govGear', (prev) => {
      const cur = { ...(prev[piece] || {}), [field]: value };
      if (field === 'from') {
        const fromO = order[String(value)] ?? 0;
        for (const l of levels) {
          if ((order[l] ?? 0) > fromO) { cur.to = l; break; }
        }
        cur.active = false;
      }
      if (field === 'to') cur.active = false;
      return { ...prev, [piece]: cur };
    });
  };

  const cards = useMemo(() => {
    const raw = GEAR_PIECES.map((piece) => {
      const s = gState[piece] || {};
      const from = s.from ?? '0';
      const to = s.to || '';
      const steps = to ? getSteps(rows, from, to, order) : [];
      let points = 0;
      const costs = { satin: 0, gilded_threads: 0, artisans_vision: 0 };
      for (const step of steps) {
        points += parseCost(step.point) * SCORE_RULES.gov_gear_score;
        costs.satin += parseCost(step.satin);
        costs.gilded_threads += parseCost(step.threads);
        costs.artisans_vision += parseCost(step.artisans);
      }
      Object.keys(costs).forEach((k) => { if (!costs[k]) delete costs[k]; });
      return { id: piece, name: piece, piece, s, from, to, steps, points, costs, active: !!s.active };
    });
    const afford = sequentialAfford(
      raw.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      vault
    );
    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      return { ...c, canAfford: a.canAfford, vaultBefore: a.vaultBefore };
    });
  }, [gState, rows, order, vault]);

  const totalPoints = useMemo(() => {
    let t = 0;
    for (const c of cards) {
      if (c.active && c.canAfford) t += c.points;
    }
    return t;
  }, [cards]);

  useEffect(() => {
    setPageLockedCosts(
      'govGear',
      sumActiveCosts(
        cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
        new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
      )
    );
  }, [cards, setPageLockedCosts]);

  useEffect(() => { setPageScore('govGear', totalPoints); }, [totalPoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="calculator-page">
      <div className="group-columns group-columns-1 gov-group-rows">
        {GEAR_GROUPS.map((group) => (
          <GroupCard
            key={group.troop}
            title={`${group.troop} Gear`}
            iconSrc={troopImg(group.troop)}
            iconAlt={group.troop}
            bodyClassName="group-card-body-items-row"
          >
            {group.pieces.map((piece) => {
              const c = cards.find((x) => x.piece === piece || x.id === piece || x.name === piece);
              if (!c) return null;
              const name = c.piece || c.id || c.name || piece;
              return (
                <div className="item-card group-card-item" key={name}>
                  <div className="item-card-header" style={{ justifyContent: 'space-evenly' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.65rem', color: '#888' }}>Current</span>
                      <AssetImg src={govGearImg(name, c.from === '0' ? null : c.from)} size={48} />
                    </div>
                    <span style={{ fontWeight: 700 }}>{name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.65rem', color: '#888' }}>Target</span>
                      <AssetImg src={govGearImg(name, c.to || null)} size={48} />
                    </div>
                  </div>
                  <div className="item-card-body">
                    <LevelSelects
                      levels={levels}
                      from={c.from ?? ''}
                      to={c.to ?? ''}
                      onFrom={(v) => setPiece(name, 'from', v)}
                      onTo={(v) => setPiece(name, 'to', v)}
                    />
                    <label className="checkbox-label" style={{ opacity: c.canAfford || !c.to ? 1 : 0.5 }}>
                      <input
                        className="checkbox"
                        type="checkbox"
                        checked={!!c.active && c.canAfford}
                        disabled={!c.to || (!c.canAfford && !c.active)}
                        onChange={(e) => setPiece(name, 'active', e.target.checked)}
                      />{' '}
                      Upgrade
                    </label>
                    <CostStatus
                      active={!!c.active && c.canAfford}
                      hasSelection={!!c.to}
                      points={c.points}
                      stepsInfo={c.steps?.length ? ` (${c.steps.length} steps)` : ''}
                      costs={c.costs}
                      vault={c.vaultBefore || vault}
                    />
                  </div>
                </div>
              );
            })}
          </GroupCard>
        ))}
      </div>
    </div>
  );
}
