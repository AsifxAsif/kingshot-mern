import { useMemo, useEffect, useCallback } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, SCORE_RULES } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { asset } from '../utils/images';
import { LevelSelects } from '../components/LevelSelects';

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Support legacy single gear/forge fields + multi items */
function normalizeGearState(s) {
  const base = s || {};
  let items = Array.isArray(base.items) ? base.items.map((it) => ({ ...it })) : [];
  if (!items.length && (base.from != null || base.to != null || base.active)) {
    items = [
      {
        id: 'gear_default',
        from: base.from ?? '',
        to: base.to ?? '',
        active: !!base.active,
      },
    ];
  }
  if (!items.length) {
    items = [{ id: newId('gear'), from: '', to: '', active: false }];
  }

  let forgeItems = Array.isArray(base.forgeItems)
    ? base.forgeItems.map((it) => ({ ...it }))
    : [];
  if (
    !forgeItems.length &&
    (base.forgeFrom != null || base.forgeTo != null || base.forgeActive)
  ) {
    forgeItems = [
      {
        id: 'forge_default',
        from: base.forgeFrom ?? '',
        to: base.forgeTo ?? '',
        active: !!base.forgeActive,
      },
    ];
  }
  if (!forgeItems.length) {
    forgeItems = [{ id: newId('forge'), from: '', to: '', active: false }];
  }

  return { items, forgeItems };
}

export default function HeroGearPage() {
  const { data, loading, error } = useGameData('hero_gears');
  const { data: forgeData, loading: forgeLoading } = useGameData('forgehammers');
  const {
    state,
    updateSection,
    setPageScore,
    setPageLockedCosts,
    remainingVaultExcluding,
  } = useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('heroGear'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );

  const normalized = useMemo(() => normalizeGearState(state.heroGear), [state.heroGear]);
  const { items, forgeItems } = normalized;

  const rows = data?.['Hero Gear'] || (Array.isArray(data) ? data : []);
  const forgeRows =
    forgeData?.Mastery ||
    forgeData?.Forgehammer ||
    (Array.isArray(forgeData) ? forgeData : []);

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

  const setListItem = (listKey, id, field, value) => {
    updateSection('heroGear', (prev) => {
      const cur = normalizeGearState(prev);
      const list = cur[listKey].map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, [field]: value };
        if (field === 'from' || field === 'to') next.active = false;
        return next;
      });
      return { ...cur, [listKey]: list };
    });
  };

  const addListItem = (listKey, prefix) => {
    updateSection('heroGear', (prev) => {
      const cur = normalizeGearState(prev);
      return {
        ...cur,
        [listKey]: [
          ...cur[listKey],
          { id: newId(prefix), from: '', to: '', active: false },
        ],
      };
    });
  };

  const removeListItem = (listKey, id, prefix) => {
    updateSection('heroGear', (prev) => {
      const cur = normalizeGearState(prev);
      let next = cur[listKey].filter((it) => it.id !== id);
      if (!next.length) next = [{ id: newId(prefix), from: '', to: '', active: false }];
      return { ...cur, [listKey]: next };
    });
  };

  const calcGearCosts = useCallback(
    (from, to) => {
      const fromN = from === '' ? null : Number(from);
      const toN = to === '' ? null : Number(to);
      if (fromN == null || toN == null || toN <= fromN) {
        return { steps: [], costs: {}, points: 0, fromN, toN };
      }
      const steps = rows.filter((r) => {
        const c = Number(r.current_lvl);
        const t = Number(r.target_lvl);
        return c >= fromN && t <= toN && t > fromN;
      });
      const costs = {};
      for (const step of steps) {
        for (const [k, v] of Object.entries(step)) {
          if (['current_lvl', 'target_lvl', 'level', 'time'].includes(k)) continue;
          const n = parseCost(v);
          if (!n) continue;
          let key = k;
          if (k === 'xp' || k === 'exp') key = 'hero_xp';
          else if (k === 'forgehammer' || k === 'forge_hammers') key = 'forge_hammer';
          costs[key] = (costs[key] || 0) + n;
        }
      }
      let points = 0;
      for (const [k, v] of Object.entries(costs)) {
        if (SCORE_RULES[k]) points += v * SCORE_RULES[k];
      }
      return { steps, costs, points, fromN, toN };
    },
    [rows]
  );

  const calcForgeCosts = useCallback(
    (from, to) => {
      const ff = from === '' ? null : Number(from);
      const ft = to === '' ? null : Number(to);
      if (ff == null || ft == null || ft <= ff) {
        return { steps: [], costs: {}, points: 0 };
      }
      const steps = forgeRows.filter((r) => {
        const c = Number(r.current_lvl);
        const t = Number(r.target_lvl);
        return c >= ff && t <= ft && t > ff;
      });
      const costs = {};
      for (const step of steps) {
        for (const [k, v] of Object.entries(step)) {
          if (['current_lvl', 'target_lvl', 'level', 'time'].includes(k)) continue;
          const n = parseCost(v);
          if (!n) continue;
          let key = k;
          if (k === 'forgehammer' || k === 'forge_hammers') key = 'forge_hammer';
          else if (k === 'xp' || k === 'exp') key = 'hero_xp';
          costs[key] = (costs[key] || 0) + n;
        }
      }
      let points = 0;
      for (const [k, v] of Object.entries(costs)) {
        if (SCORE_RULES[k]) points += v * SCORE_RULES[k];
      }
      return { steps, costs, points };
    },
    [forgeRows]
  );

  const gearCards = useMemo(
    () =>
      items.map((it) => {
        const calc = calcGearCosts(it.from, it.to);
        return {
          ...it,
          ...calc,
          displayImg:
            (calc.toN != null && calc.toN > 100) || (calc.fromN != null && calc.fromN > 100)
              ? asset('hero-gear-red.webp')
              : asset('hero-gear-mythic.webp'),
        };
      }),
    [items, calcGearCosts]
  );

  const forgeCards = useMemo(
    () =>
      forgeItems.map((it) => ({
        ...it,
        ...calcForgeCosts(it.from, it.to),
      })),
    [forgeItems, calcForgeCosts]
  );

  const seq = useMemo(() => {
    const seqItems = [
      ...gearCards.map((c) => ({ id: c.id, costs: c.costs, active: !!c.active })),
      ...forgeCards.map((c) => ({ id: c.id, costs: c.costs, active: !!c.active })),
    ];
    return sequentialAfford(seqItems, vault || {});
  }, [gearCards, forgeCards, vault]);

  const total = useMemo(() => {
    let p = 0;
    for (const c of [...gearCards, ...forgeCards]) {
      if (c.active && seq.get(c.id)?.canAfford) p += c.points;
    }
    return p;
  }, [gearCards, forgeCards, seq]);

  useEffect(() => {
    const all = [
      ...gearCards.map((c) => ({ id: c.id, costs: c.costs, active: !!c.active })),
      ...forgeCards.map((c) => ({ id: c.id, costs: c.costs, active: !!c.active })),
    ];
    const map = new Map(all.map((c) => [c.id, { canAfford: seq.get(c.id)?.canAfford ?? true }]));
    setPageLockedCosts('heroGear', sumActiveCosts(all, map));
  }, [gearCards, forgeCards, seq, setPageLockedCosts]);

  useEffect(() => {
    setPageScore('heroGear', total);
  }, [total, setPageScore]);

  if (loading || forgeLoading)
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
      <div className="hero-gear-two-col">
        {/* Column 1 — Gear */}
        <div className="hero-gear-col">
          <div className="section-title">Hero Gear</div>
          {gearCards.map((c, idx) => {
            const canAfford = seq.get(c.id)?.canAfford ?? true;
            const gearVault = seq.get(c.id)?.vaultBefore || vault;
            return (
              <div className="item-card" key={c.id} style={{ marginBottom: 12 }}>
                <div className="item-card-header">
                  <AssetImg src={c.displayImg} size={50} />
                  <span>Hero Gear #{idx + 1}</span>
                  {gearCards.length > 1 && (
                    <button
                      type="button"
                      className="preset-btn btn-delete"
                      style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '4px 8px' }}
                      onClick={() => removeListItem('items', c.id, 'gear')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="item-card-body">
                  <LevelSelects
                    levels={levels}
                    from={c.from ?? ''}
                    to={c.to ?? ''}
                    onFrom={(v) => setListItem('items', c.id, 'from', v)}
                    onTo={(v) => setListItem('items', c.id, 'to', v)}
                    highest={levels[levels.length - 1]}
                  />
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        className="checkbox"
                        type="checkbox"
                        checked={!!c.active && canAfford}
                        disabled={!c.to || !canAfford}
                        onChange={(e) => setListItem('items', c.id, 'active', e.target.checked)}
                      />{' '}
                      Upgrade
                    </label>
                  </div>
                  <CostStatus
                    active={!!c.active && canAfford}
                    hasSelection={!!c.to && c.steps.length > 0}
                    points={c.points}
                    stepsInfo={` (${c.steps.length} steps)`}
                    costs={c.costs}
                    vault={gearVault}
                  />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="preset-btn"
            style={{ width: '100%' }}
            onClick={() => addListItem('items', 'gear')}
          >
            + Add item
          </button>
        </div>

        {/* Column 2 — Forgehammer */}
        <div className="hero-gear-col">
          <div className="section-title">Forgehammer Mastery</div>
          {forgeCards.map((c, idx) => {
            const canAfford = seq.get(c.id)?.canAfford ?? true;
            const forgeVault = seq.get(c.id)?.vaultBefore || vault;
            return (
              <div className="item-card" key={c.id} style={{ marginBottom: 12 }}>
                <div className="item-card-header">
                  <AssetImg src={asset('forge_hammer.webp')} size={50} />
                  <span>Forgehammer #{idx + 1}</span>
                  {forgeCards.length > 1 && (
                    <button
                      type="button"
                      className="preset-btn btn-delete"
                      style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '4px 8px' }}
                      onClick={() => removeListItem('forgeItems', c.id, 'forge')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="item-card-body">
                  <LevelSelects
                    levels={forgeLevels}
                    from={c.from ?? ''}
                    to={c.to ?? ''}
                    onFrom={(v) => setListItem('forgeItems', c.id, 'from', v)}
                    onTo={(v) => setListItem('forgeItems', c.id, 'to', v)}
                    highest={forgeLevels[forgeLevels.length - 1]}
                  />
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        className="checkbox"
                        type="checkbox"
                        checked={!!c.active && canAfford}
                        disabled={!c.to || !canAfford}
                        onChange={(e) =>
                          setListItem('forgeItems', c.id, 'active', e.target.checked)
                        }
                      />{' '}
                      Upgrade
                    </label>
                  </div>
                  <CostStatus
                    active={!!c.active && canAfford}
                    hasSelection={!!c.to && c.steps.length > 0}
                    points={c.points}
                    stepsInfo={` (${c.steps.length} steps)`}
                    costs={c.costs}
                    vault={forgeVault}
                  />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="preset-btn"
            style={{ width: '100%' }}
            onClick={() => addListItem('forgeItems', 'forge')}
          >
            + Add item
          </button>
        </div>
      </div>
    </div>
  );
}
