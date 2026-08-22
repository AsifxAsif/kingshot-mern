import { useMemo, useEffect, useState } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, SCORE_RULES } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import GroupCard from '../components/GroupCard';
import { asset, troopImg } from '../utils/images';

/** 6 slot types × 3 charms = 18 (matches old site) */
const CHARM_GROUPS = [
  {
    type: 'Helmet',
    troop: 'Cavalry',
    charms: ['Helmet Charm #1', 'Helmet Charm #2', 'Helmet Charm #3'],
  },
  {
    type: 'Watch',
    troop: 'Cavalry',
    charms: ['Watch Charm #1', 'Watch Charm #2', 'Watch Charm #3'],
  },
  {
    type: 'Armor',
    troop: 'Infantry',
    charms: ['Armor Charm #1', 'Armor Charm #2', 'Armor Charm #3'],
  },
  {
    type: 'Pant',
    troop: 'Infantry',
    charms: ['Pant Charm #1', 'Pant Charm #2', 'Pant Charm #3'],
  },
  {
    type: 'Belt',
    troop: 'Archer',
    charms: ['Belt Charm #1', 'Belt Charm #2', 'Belt Charm #3'],
  },
  {
    type: 'Weapon',
    troop: 'Archer',
    charms: ['Weapon Charm #1', 'Weapon Charm #2', 'Weapon Charm #3'],
  },
];

const TROOP_ORDER = ['Cavalry', 'Infantry', 'Archer'];

/** Old site: assets/gov_charms/{cavalry|infantry|archery}_lvl{N}.webp */
function charmImg(type, levelName) {
  const typeMap = {
    Helmet: 'cavalry',
    Watch: 'cavalry',
    Armor: 'infantry',
    Pant: 'infantry',
    Belt: 'archery',
    Weapon: 'archery',
    cavalry: 'cavalry',
    infantry: 'infantry',
    archery: 'archery',
    archer: 'archery',
  };
  const folderType = typeMap[type] || typeMap[String(type)] || 'infantry';
  let level = '1';
  if (levelName) {
    const s = String(levelName).trim();
    if (s && s !== '0') {
      const m = s.match(/Level\s*(\d+)/i) || s.match(/(\d+)/);
      if (m) level = m[1];
    }
  }
  return asset(`gov_charms/${folderType}_lvl${level}.webp`);
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
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } =
    useApp();
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

  const [groupSet, setGroupSet] = useState({});

  const allCharmNames = useMemo(
    () => CHARM_GROUPS.flatMap((g) => g.charms),
    []
  );

  const setPiece = (piece, field, value) => {
    if (!piece || !allCharmNames.includes(piece)) return;
    updateSection('govCharm', (prev) => {
      const cleaned = {};
      for (const k of allCharmNames) {
        if (prev[k] != null) cleaned[k] = prev[k];
      }
      const cur = { ...(cleaned[piece] || {}), [field]: value };
      if (field === 'from') {
        const next = nextLvl(levels, value, order);
        if (next) cur.to = next;
        cur.active = false;
      }
      if (field === 'to') cur.active = false;
      if (
        (cur.from == null || cur.from === '' || cur.from === '0') &&
        (cur.to == null || cur.to === '') &&
        !cur.active
      ) {
        delete cleaned[piece];
      } else {
        cleaned[piece] = cur;
      }
      return cleaned;
    });
  };

  // Prune invalid keys left from older builds
  useEffect(() => {
    const c = state.govCharm || {};
    const bad = Object.keys(c).filter((k) => !allCharmNames.includes(k));
    if (!bad.length) return;
    updateSection('govCharm', (prev) => {
      const cleaned = {};
      for (const k of allCharmNames) {
        if (prev[k] != null) cleaned[k] = prev[k];
      }
      return cleaned;
    });
  }, [state.govCharm, allCharmNames, updateSection]);

  const applyGroupLevel = (group, field, raw) => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    const numeric = clean.replace(/^Level\s*/i, '');
    let match = levels.find((l) => String(l).replace(/^Level\s*/i, '') === numeric || l === clean);
    if (!match && field === 'from' && (numeric === '0' || clean === '0')) match = '0';
    if (!match) return;
    for (const charm of group.charms) {
      setPiece(charm, field, match);
    }
  };

  const cards = useMemo(() => {
    const raw = allCharmNames.map((name) => {
      const group = CHARM_GROUPS.find((g) => g.charms.includes(name));
      const type = group?.type || 'Helmet';
      const troop = group?.troop || 'Infantry';
      const s = cState[name] || {};
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
      return {
        id: name,
        name,
        type,
        troop,
        s,
        from,
        to,
        steps,
        points,
        costs,
        active: !!s.active,
      };
    });
    const afford = sequentialAfford(
      raw.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      vault
    );
    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      return { ...c, canAfford: a.canAfford, vaultBefore: a.vaultBefore };
    });
  }, [cState, rows, order, vault, allCharmNames]);

  const totalPoints = useMemo(() => {
    let t = 0;
    for (const c of cards) if (c.active && c.canAfford) t += c.points;
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

  useEffect(() => {
    setPageScore('govCharm', totalPoints);
  }, [totalPoints, setPageScore]);

  if (loading)
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  if (error)
    return (
      <div className="page-error">
        <p>{error}</p>
      </div>
    );

  return (
    <div className="calculator-page">
      <div className="group-columns group-columns-1 gov-group-rows">
        {TROOP_ORDER.map((troop) => {
          const groups = CHARM_GROUPS.filter((g) => g.troop === troop);
          return (
            <GroupCard
              key={troop}
              title={`${troop} Charms`}
              iconSrc={troopImg(troop)}
              iconAlt={troop}
              bodyClassName="group-card-body-items-row"
            >
              {groups.map((group) => (
                <div key={group.type} className="gov-sub-group">
                  <div className="gov-sub-group-header">
                    <strong>{group.type}</strong>
                    <div className="group-set-row">
                      <input
                        className="hero-shard-input"
                        placeholder="Current"
                        value={groupSet[`${group.type}_from`] ?? ''}
                        onChange={(e) =>
                          setGroupSet((p) => ({ ...p, [`${group.type}_from`]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() =>
                          applyGroupLevel(group, 'from', groupSet[`${group.type}_from`])
                        }
                      >
                        Set current
                      </button>
                      <input
                        className="hero-shard-input"
                        placeholder="Target"
                        value={groupSet[`${group.type}_to`] ?? ''}
                        onChange={(e) =>
                          setGroupSet((p) => ({ ...p, [`${group.type}_to`]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => applyGroupLevel(group, 'to', groupSet[`${group.type}_to`])}
                      >
                        Set target
                      </button>
                    </div>
                  </div>
                  <div className="gov-sub-group-items">
                  {group.charms.map((name) => {
                    const c = cards.find((x) => x.name === name);
                    if (!c) return null;
                    return (
                      <div className="item-card group-card-item" key={c.name}>
                        <div className="item-card-header" style={{ justifyContent: 'space-evenly' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.65rem', color: '#888' }}>Current</span>
                            <AssetImg
                              src={charmImg(c.type, c.from === '0' ? 'Level 1' : c.from)}
                              size={40}
                            />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{c.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.65rem', color: '#888' }}>Target</span>
                            <AssetImg src={charmImg(c.type, c.to || 'Level 1')} size={40} />
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
                          {(() => {
                            const atMax = levels.length > 0 && String(c.from ?? '0') === String(levels[levels.length - 1]);
                            return (
                          <>
                          {!atMax && (
                          <label
                            className="checkbox-label"
                            style={{ opacity: c.canAfford || !c.to ? 1 : 0.5 }}
                          >
                            <input
                              className="checkbox"
                              type="checkbox"
                              checked={!!c.active && c.canAfford}
                              disabled={!c.to || (!c.canAfford && !c.active)}
                              onChange={(e) => setPiece(c.name, 'active', e.target.checked)}
                            />{' '}
                            Upgrade
                          </label>
                          )}
                          <CostStatus
                            active={!!c.active && c.canAfford}
                            hasSelection={!!c.to}
                            atMax={atMax}
                            points={c.points}
                            stepsInfo={` (${c.steps.length} steps)`}
                            costs={c.costs}
                            vault={c.vaultBefore || vault}
                          />
                          </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              ))}
            </GroupCard>
          );
        })}
      </div>
    </div>
  );
}
