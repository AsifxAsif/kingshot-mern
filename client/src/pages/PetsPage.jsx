import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import ShowMaxedToggle, { useShowMaxedItems, isAtMaxLevel } from '../components/ShowMaxedToggle';
import {
  parseCost,
  formatNumber,
  getUpgradeSteps,
  getLevelsFromArray,
  SCORE_RULES,
} from '../utils/calc';
import { sequentialAfford, sumActiveCosts } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { petImg, resourceImg } from '../utils/images';

const RES = [
  'pet_food',
  'growth_manual',
  'nutrient_potion',
  'promotion_medallion',
  'bread',
  'wood',
  'stone',
  'iron',
  'gold',
];

/** Original pets.js getPetAdvancementPoints */
function getPetAdvancementPoints(targetLevelStr) {
  const levelStr = String(targetLevelStr).toLowerCase().trim();
  const match = levelStr.match(/^(\d+)_[Aa]dvancement$/);
  if (!match) return 0;
  const baseMilestone = parseInt(match[1], 10);
  const milestoneMap = {
    10: 500,
    20: 1000,
    30: 2000,
    40: 3000,
    50: 4500,
    60: 6750,
    70: 10000,
    80: 12000,
    90: 14500,
    100: 17500,
  };
  const basePoints = milestoneMap[baseMilestone] || 0;
  return basePoints * 50;
}

/**
 * Manual "use X taming marks" for event points.
 * Inventory stays in Vault; this records how many marks you will spend.
 * Cost / remaining display matches CostStatus used on every other card.
 */
function TamingMarksCard({ vault }) {
  const { state, updateSection } = useApp();
  const usage = state.settings?.tamingMarks || {};

  const advancedQty = parseCost(usage.advanced);
  const commonQty = parseCost(usage.common);
  const active = !!usage.active;

  const advancedPts = advancedQty * (SCORE_RULES.advanced_taming_mark || 15000);
  const commonPts = commonQty * (SCORE_RULES.common_taming_mark || 1150);
  const totalPts = advancedPts + commonPts;

  const costs = {};
  if (advancedQty > 0) costs.advanced_taming_mark = advancedQty;
  if (commonQty > 0) costs.common_taming_mark = commonQty;
  const hasSelection = advancedQty > 0 || commonQty > 0;

  const setUsage = (field, value) => {
    updateSection('settings', (prev) => ({
      ...prev,
      tamingMarks: {
        ...(prev.tamingMarks || {}),
        [field]: value,
      },
    }));
  };

  return (
    <div className="item-card" style={{ marginBottom: 16, gridColumn: '1 / -1' }}>
      <div className="item-card-header">
        <AssetImg src={resourceImg('advanced_taming_mark')} size={40} alt="Taming Marks" />
        <span>TAMING MARKS POINTS</span>
      </div>
      <div className="item-card-body">
        <div className="buff-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div className="buff-field" style={{ flex: '1 1 160px' }}>
            <label className="img-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AssetImg src={resourceImg('advanced_taming_mark')} size={22} />
              <span>Advanced Taming Mark (use)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 5 or 1.2K"
              value={usage.advanced ?? ''}
              onChange={(e) => setUsage('advanced', e.target.value)}
              style={{ textAlign: 'center', width: '100%' }}
            />
            <small style={{ opacity: 0.75 }}>
              {formatNumber(SCORE_RULES.advanced_taming_mark)} pts each
            </small>
          </div>

          <div className="buff-field" style={{ flex: '1 1 160px' }}>
            <label className="img-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AssetImg src={resourceImg('common_taming_mark')} size={22} />
              <span>Common Taming Mark (use)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 20 or 500"
              value={usage.common ?? ''}
              onChange={(e) => setUsage('common', e.target.value)}
              style={{ textAlign: 'center', width: '100%' }}
            />
            <small style={{ opacity: 0.75 }}>
              {formatNumber(SCORE_RULES.common_taming_mark)} pts each
            </small>
          </div>
        </div>

        <label className="checkbox-label" style={{ marginTop: 12, display: 'inline-flex' }}>
          <input
            className="checkbox"
            type="checkbox"
            checked={active}
            disabled={!hasSelection}
            onChange={(e) => setUsage('active', e.target.checked)}
          />
          <span>Count taming mark points</span>
        </label>

        {/* Same cost / vault remaining UI as every other upgrade card */}
        <CostStatus
          active={active && hasSelection}
          hasSelection={hasSelection}
          points={totalPts}
          costs={costs}
          vault={vault}
          emptyHint="Enter how many marks you will use"
          extra={
            hasSelection ? (
              <div style={{ marginBottom: 4, opacity: 0.9, fontSize: '0.9rem' }}>
                Advanced: +{formatNumber(advancedPts)} pts · Common: +{formatNumber(commonPts)} pts
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

export default function PetsPage() {
  const { data, loading, error } = useGameData('pets');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } =
    useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('pets'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const petsState = state.pets || {};
  const showMaxed = useShowMaxedItems();
  const taming = state.settings?.tamingMarks || {};
  const root = data?.Pet || data || {};
  const petNames = useMemo(
    () => Object.keys(root).filter((k) => Array.isArray(root[k])),
    [root]
  );

  const setField = (name, field, value) => {
    updateSection('pets', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' || field === 'to') cur.active = false;
      return { ...prev, [name]: cur };
    });
  };

  const cards = useMemo(() => {
    const raw = petNames.map((name) => {
      const rows = root[name] || [];
      const levels = getLevelsFromArray(
        rows,
        ['level', 'current_lvl', 'current', 'target_lvl', 'target'],
        { includeZero: true }
      );
      const s = petsState[name] || {};
      const from = s.from ?? '0';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from || '0', to) : [];
      const costs = {};
      let points = 0;
      for (const step of steps) {
        for (const k of RES) {
          if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
        }
        const targetLvl = step.target_lvl || step.target || step.level;
        const advPts = getPetAdvancementPoints(targetLvl);
        if (advPts > 0) {
          points += advPts;
        } else {
          points += parseCost(step.point ?? step.points ?? step.score ?? 0);
        }
        // Marks used by upgrade steps still cost vault stock, but points for marks
        // come only from the Taming Marks card (to avoid double-counting).
        const adv = parseCost(step.advanced_taming_mark);
        const common = parseCost(step.common_taming_mark);
        if (adv) costs.advanced_taming_mark = (costs.advanced_taming_mark || 0) + adv;
        if (common) costs.common_taming_mark = (costs.common_taming_mark || 0) + common;
      }
      Object.keys(costs).forEach((k) => {
        if (!costs[k]) delete costs[k];
      });
      return { id: name, name, levels, s, from, to, steps, costs, points, active: !!s.active };
    });
    const afford = sequentialAfford(
      raw.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      vault
    );
    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      return { ...c, canAfford: a.canAfford, vaultBefore: a.vaultBefore };
    });
  }, [petNames, root, petsState, vault]);

  const tamingQtyAdv = parseCost(taming.advanced);
  const tamingQtyCommon = parseCost(taming.common);
  const tamingActive = !!taming.active;
  const tamingPoints = tamingActive
    ? tamingQtyAdv * (SCORE_RULES.advanced_taming_mark || 15000) +
      tamingQtyCommon * (SCORE_RULES.common_taming_mark || 1150)
    : 0;

  const hasMaxedItems = useMemo(
    () => cards.some((c) => isAtMaxLevel(c.from, c.levels)),
    [cards]
  );

    const petUpgradeTotal = useMemo(
    () => cards.reduce((s, c) => s + (c.active && c.canAfford ? c.points : 0), 0),
    [cards]
  );

  const total = petUpgradeTotal + tamingPoints;

  useEffect(() => {
    const fromPets = sumActiveCosts(
      cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
      new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
    );
    // Merge manual taming-mark usage into pets locked costs when Active
    if (tamingActive) {
      if (tamingQtyAdv > 0) {
        fromPets.advanced_taming_mark =
          (fromPets.advanced_taming_mark || 0) + tamingQtyAdv;
      }
      if (tamingQtyCommon > 0) {
        fromPets.common_taming_mark =
          (fromPets.common_taming_mark || 0) + tamingQtyCommon;
      }
    }
    setPageLockedCosts('pets', fromPets);
  }, [cards, tamingActive, tamingQtyAdv, tamingQtyCommon, setPageLockedCosts]);

  useEffect(() => {
    setPageScore('pets', total);
  }, [total, setPageScore]);

  // Clear any leftover vault page score from the previous mistaken placement
  useEffect(() => {
    setPageScore('vault', 0);
    setPageLockedCosts('vault', {});
  }, [setPageScore, setPageLockedCosts]);

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
    <div className="app-container">
      <ShowMaxedToggle hasMaxed={hasMaxedItems} />
      <TamingMarksCard vault={vault} />

      <div className="items-grid cards-grid">
        {cards.filter((c) => showMaxed || !isAtMaxLevel(c.from, c.levels)).map((c) => (
          <div className="item-card" key={c.name}>
            <div className="item-card-header">
              <AssetImg src={petImg(c.name)} size={40} />
              <span>{c.name}</span>
            </div>
            <div className="item-card-body">
              <LevelSelects
                levels={c.levels}
                from={c.s.from ?? ''}
                to={c.s.to ?? ''}
                onFrom={(v) => setField(c.name, 'from', v)}
                onTo={(v) => setField(c.name, 'to', v)}
              />
              {(() => {
                const atMax = c.levels.length > 0 && String(c.from) === String(c.levels[c.levels.length - 1]);
                return (
              <>
              {!atMax && (
              <label
                className={`checkbox-label${!c.canAfford || !c.to ? ' is-disabled' : ''}`}
                style={{ opacity: c.canAfford && c.to ? 1 : 0.42 }}
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={!!c.active && c.canAfford}
                  disabled={!c.to || c.steps.length === 0 || !c.canAfford}
                  onChange={(e) => setField(c.name, 'active', e.target.checked)}
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
        ))}
      </div>
    </div>
  );
}
