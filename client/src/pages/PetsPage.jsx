import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
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
import { petImg } from '../utils/images';

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

export default function PetsPage() {
  const { data, loading, error } = useGameData('pets');
  const { state, updateSection, setPageScore, setPageLockedCosts, remainingVaultExcluding } = useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('pets'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const petsState = state.pets || {};
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
        const adv = parseCost(step.advanced_taming_mark);
        const common = parseCost(step.common_taming_mark);
        if (adv) {
          costs.advanced_taming_mark = (costs.advanced_taming_mark || 0) + adv;
          points += adv * (SCORE_RULES.advanced_taming_mark || 0);
        }
        if (common) {
          costs.common_taming_mark = (costs.common_taming_mark || 0) + common;
          points += common * (SCORE_RULES.common_taming_mark || 0);
        }
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

  const total = useMemo(
    () => cards.reduce((s, c) => s + (c.active && c.canAfford ? c.points : 0), 0),
    [cards]
  );

  useEffect(() => {
    setPageLockedCosts(
      'pets',
      sumActiveCosts(
        cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
        new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
      )
    );
  }, [cards, setPageLockedCosts]);

  useEffect(() => {
    setPageScore('pets', total);
  }, [total, setPageScore]);

  if (loading)
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      <div className="items-grid cards-grid">
        {cards.map((c) => (
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
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={!!c.active && c.canAfford}
                  disabled={!c.to || c.steps.length === 0 || !c.canAfford}
                  onChange={(e) => setField(c.name, 'active', e.target.checked)}
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
