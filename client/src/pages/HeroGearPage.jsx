import { useMemo, useEffect, useCallback } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { useScoreRules } from '../hooks/useScoreRules';
import { usePublishPageScore } from '../hooks/usePublishPageScore';
import ShowMaxedToggle, { useShowMaxedItems, isAtMaxLevel } from '../components/ShowMaxedToggle';
import PageOptionsBar from '../components/PageOptionsBar';
import { parseCost } from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { asset } from '../utils/images';
import { LevelSelects } from '../components/LevelSelects';

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Forgehammer Mastery required to enhance gear to `targetLv` (Red path). */
/**
 * Forgehammer Mastery required for Red gear target level.
 * Mythic (≤100): none. Red: Mastery = target − 109 (min 1, max 20).
 * Examples: +110 → 1, +119 → 10, +120 → 11, +129 → 20, +200 → 20.
 */
function masteryReqForGearLevel(targetLv) {
  const n = Number(targetLv) || 0;
  if (n <= 100) return 0;
  return Math.min(20, Math.max(1, n - 109));
}


/** Support legacy single gear/forge fields + multi items */
function normalizeGearState(s) {
  const base = s || {};
  let items = Array.isArray(base.items)
    ? base.items.map((it) => ({ mastery: '', ...it }))
    : [];
  if (!items.length && (base.from != null || base.to != null || base.active)) {
    items = [
      {
        id: 'gear_default',
        from: base.from ?? '',
        to: base.to ?? '',
        active: !!base.active,
        mastery: base.mastery ?? '',
      },
    ];
  }
  if (!items.length) {
    items = [{ id: newId('gear'), from: '', to: '', active: false, mastery: '' }];
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
  const { scoreRules: SCORE_RULES, eventId: activeEventId } = useScoreRules();
  const showMaxed = useShowMaxedItems();
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
        if (field === 'from' || field === 'to' || field === 'mastery') next.active = false;
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
          {
            id: newId(prefix),
            from: '',
            to: '',
            active: false,
            ...(prefix === 'gear' ? { mastery: '' } : {}),
          },
        ],
      };
    });
  };

  const removeListItem = (listKey, id, prefix) => {
    updateSection('heroGear', (prev) => {
      const cur = normalizeGearState(prev);
      let next = cur[listKey].filter((it) => it.id !== id);
      if (!next.length)
        next = [
          {
            id: newId(prefix),
            from: '',
            to: '',
            active: false,
            ...(prefix === 'gear' ? { mastery: '' } : {}),
          },
        ];
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
        const rate = Number(SCORE_RULES[k] ?? 0);
        if (rate) points += v * rate;
      }
      return { steps, costs, points, fromN, toN };
    },
    [rows, SCORE_RULES]
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
        const rate = Number(SCORE_RULES[k] ?? 0);
        if (rate) points += v * rate;
      }
      return { steps, costs, points };
    },
    [forgeRows, SCORE_RULES]
  );


  const gearCards = useMemo(
    () =>
      items.map((it) => {
        const calc = calcGearCosts(it.from, it.to);
        const toN = calc.toN != null ? calc.toN : Number(it.to) || 0;
        // Highest mastery required for any level in the selected upgrade path
        let needMastery = masteryReqForGearLevel(toN);
        for (const step of calc.steps || []) {
          const lv = Number(step.target_lvl ?? step.to ?? step.level) || 0;
          needMastery = Math.max(needMastery, masteryReqForGearLevel(lv));
        }
        // Per-gear Mastery input on this card (not linked to Forgehammer card)
        const masteryHave = Math.max(0, parseCost(it.mastery));
        const prereqItems = [];
        if (needMastery > 0) {
          const met = masteryHave >= needMastery;
          prereqItems.push({
            raw: `Mastery ${needMastery}`,
            name: 'Mastery',
            level: needMastery,
            have: masteryHave,
            met,
            tracked: true,
            detail: met ? undefined : `have ${masteryHave}, need ${needMastery}`,
          });
        }
        const prereqsMet = prereqItems.every((x) => x.met);
        return {
          ...it,
          ...calc,
          needMastery,
          masteryHave,
          prereqItems,
          prereqsMet,
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
      ...gearCards.map((c) => ({
        id: c.id,
        costs: c.costs,
        active: !!c.active && (c.prereqsMet !== false),
      })),
      ...forgeCards.map((c) => ({ id: c.id, costs: c.costs, active: !!c.active })),
    ];
    return sequentialAfford(seqItems, vault || {});
  }, [gearCards, forgeCards, vault, SCORE_RULES, activeEventId]);

  const total = useMemo(() => {
    let p = 0;
    for (const c of gearCards) {
      if (c.active && c.prereqsMet !== false && seq.get(c.id)?.canAfford) p += c.points;
    }
    for (const c of forgeCards) {
      if (c.active && seq.get(c.id)?.canAfford) p += c.points;
    }
    return p;
  }, [gearCards, forgeCards, seq]);

  useEffect(() => {
    const all = [
      ...gearCards.map((c) => ({
        id: c.id,
        costs: c.costs,
        active: !!c.active && (c.prereqsMet !== false),
      })),
      ...forgeCards.map((c) => ({ id: c.id, costs: c.costs, active: !!c.active })),
    ];
    const map = new Map(all.map((c) => [c.id, { canAfford: seq.get(c.id)?.canAfford ?? true }]));
    setPageLockedCosts('heroGear', sumActiveCosts(all, map));
  }, [gearCards, forgeCards, seq, setPageLockedCosts]);

  const hasMaxedItems = useMemo(
    () =>
      gearCards.some((c) => isAtMaxLevel(c.from, levels)) ||
      forgeCards.some((c) => isAtMaxLevel(c.from, forgeLevels)),
    [gearCards, forgeCards, levels, forgeLevels]
  );

    usePublishPageScore('heroGear', total);

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
      <PageOptionsBar hasMaxed={hasMaxedItems} />
      <div className="hero-gear-two-col">
        {/* Column 1 — Gear */}
        <div className="hero-gear-col">
          <div className="section-title">Hero Gear</div>
          {gearCards.filter((c) => showMaxed || !isAtMaxLevel(c.from, levels)).map((c, idx) => {
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
                  <div
                    className="level-selects gear-level-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 10,
                      alignItems: 'end',
                      marginBottom: 8,
                    }}
                  >
                    <div className="buff-field" style={{ margin: 0 }}>
                      <label>Current Level</label>
                      <select
                        value={c.from ?? ''}
                        onChange={(e) => setListItem('items', c.id, 'from', e.target.value)}
                      >
                        <option value="">—</option>
                        {levels.map((lv) => (
                          <option key={`from-${lv}`} value={lv}>
                            {lv}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="buff-field" style={{ margin: 0 }}>
                      <label>Target Level</label>
                      <select
                        value={c.to ?? ''}
                        onChange={(e) => setListItem('items', c.id, 'to', e.target.value)}
                      >
                        <option value="">—</option>
                        {levels.map((lv) => (
                          <option key={`to-${lv}`} value={lv}>
                            {lv}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="buff-field" style={{ margin: 0 }}>
                      <label htmlFor={`gear-mastery-${c.id}`}>Mastery</label>
                      <div
                        className="mastery-split-input"
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          width: '100%',
                          border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: 'var(--surface, #fff)',
                        }}
                      >
                        <input
                          id={`gear-mastery-${c.id}`}
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={c.mastery ?? ''}
                          onChange={(e) =>
                            setListItem('items', c.id, 'mastery', e.target.value)
                          }
                          style={{
                            flex: '1 1 50%',
                            minWidth: 0,
                            border: 'none',
                            borderRadius: 0,
                            outline: 'none',
                            boxShadow: 'none',
                            textAlign: 'center',
                          }}
                        />
                        <div
                          style={{
                            flex: '1 1 50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            padding: '0 8px',
                            borderLeft: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                            background:
                              c.needMastery > 0 && c.to
                                ? c.prereqsMet !== false
                                  ? 'rgba(40, 167, 69, 0.12)'
                                  : 'rgba(220, 53, 69, 0.12)'
                                : 'var(--hover-fill, rgba(0,0,0,0.04))',
                            color:
                              c.needMastery > 0 && c.to
                                ? c.prereqsMet !== false
                                  ? 'var(--success, #28a745)'
                                  : 'var(--danger, #dc3545)'
                                : 'inherit',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            opacity: c.needMastery > 0 && c.to ? 1 : 0.55,
                          }}
                          title={
                            c.needMastery > 0 && c.to
                              ? `Required Mastery Lv. ${c.needMastery}`
                              : 'No Mastery required for this target'
                          }
                        >
                          {c.needMastery > 0 && c.to
                            ? c.prereqsMet !== false
                              ? `Need ${c.needMastery} ✓`
                              : `Need ${c.needMastery}`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const atMax = levels.length > 0 && String(c.from ?? '') === String(levels[levels.length - 1]);
                    return (
                  <>
                  {!atMax && (
                  <div className="checkbox-group">
                    <label className={`checkbox-label${!canAfford || !c.to || c.prereqsMet === false ? ' is-disabled' : ''}`}
                      style={{ opacity: canAfford && c.to && c.prereqsMet !== false ? 1 : 0.42 }}>
                      <input
                        className="checkbox"
                        type="checkbox"
                        checked={!!c.active && canAfford && c.prereqsMet !== false}
                        disabled={!c.to || !canAfford || c.prereqsMet === false}
                        onChange={(e) => setListItem('items', c.id, 'active', e.target.checked)}
                      />{' '}
                      Upgrade
                    </label>
                  </div>
                  )}
                  <CostStatus
                    active={!!c.active && canAfford && c.prereqsMet !== false}
                    hasSelection={!!c.to && c.steps.length > 0}
                    atMax={atMax}
                    points={c.points}
                    stepsInfo={` (${c.steps.length} steps)`}
                    costs={c.costs}
                    vault={gearVault}
                  />
                  </>
                    );
                  })()}
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
          {forgeCards.filter((c) => showMaxed || !isAtMaxLevel(c.from, forgeLevels)).map((c, idx) => {
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
                  {(() => {
                    const atMax = forgeLevels.length > 0 && String(c.from ?? '') === String(forgeLevels[forgeLevels.length - 1]);
                    return (
                  <>
                  {!atMax && (
                  <div className="checkbox-group">
                    <label className={`checkbox-label${!canAfford || !c.to ? ' is-disabled' : ''}`}
                      style={{ opacity: canAfford && c.to ? 1 : 0.42 }}>
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
                  )}
                  <CostStatus
                    active={!!c.active && canAfford}
                    hasSelection={!!c.to && c.steps.length > 0}
                    atMax={atMax}
                    points={c.points}
                    stepsInfo={` (${c.steps.length} steps)`}
                    costs={c.costs}
                    vault={forgeVault}
                  />
                  </>
                    );
                  })()}
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
