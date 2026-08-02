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
import { computeAffordability } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { petImg } from '../utils/images';

const RES = [
  'pet_food', 'common_taming_mark', 'advanced_taming_mark',
  'growth_manual', 'nutrient_potion', 'promotion_medallion',
];

function getAdvancementPoints(targetLevel) {
  if (!targetLevel) return 0;
  const match = String(targetLevel).match(/^(\d+)_Advancement$/i);
  if (!match) return 0;
  const milestone = parseInt(match[1], 10);
  const milestoneMap = {
    10: 500, 20: 1000, 30: 2000, 40: 3000, 50: 4500,
    60: 6750, 70: 10000, 80: 12000, 90: 14500, 100: 17500
  };
  return (milestoneMap[milestone] || 0) * 50;
}

export default function PetsPage() {
  const { data, loading, error } = useGameData('pets');
  const { state, updateSection, setPageScore, vault } = useApp();
  const petsState = state.pets || {};

  const petNames = useMemo(() => {
    const root = data?.Pet || data || {};
    return Object.keys(root).filter((k) => Array.isArray(root[k]));
  }, [data]);

  const root = data?.Pet || data || {};

  const setField = (name, field, value) => {
    updateSection('pets', (prev) => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [field]: value },
    }));
  };

  const cards = useMemo(() => {
    const result = [];
    for (const name of petNames) {
      const rows = root[name] || [];
      const levels = getLevelsFromArray(rows, ['level', 'current_lvl', 'current', 'target_lvl', 'target'], { includeZero: true });
      const s = petsState[name] || {};
      const from = s.from ?? '';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from, to) : [];
      const costs = {};
      let adv = 0, common = 0, advancementPoints = 0;
      for (const step of steps) {
        for (const k of RES) {
          if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
        }
        adv += parseCost(step.advanced_taming_mark);
        common += parseCost(step.common_taming_mark);
        const targetLvl = step.target_lvl || step.target || step.level;
        advancementPoints += getAdvancementPoints(targetLvl);
      }
      const points = adv * SCORE_RULES.advanced_taming_mark + common * SCORE_RULES.common_taming_mark + advancementPoints;
      const { canAfford } = computeAffordability(costs, vault);
      const hasSteps = steps.length > 0;
      result.push({
        name,
        levels,
        s,
        from,
        to,
        steps,
        costs,
        points,
        canAfford,
        hasSteps,
      });
    }
    return result;
  }, [petNames, root, petsState, vault]);

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const c of cards) {
      if (c.s.active && c.canAfford) total += c.points;
    }
    return total;
  }, [cards]);

  useEffect(() => {
    setPageScore('pets', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
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
                from={c.from}
                to={c.to}
                onFrom={(v) => setField(c.name, 'from', v)}
                onTo={(v) => setField(c.name, 'to', v)}
              />
              <label className="checkbox-label" style={{ opacity: c.canAfford && c.to ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={!!c.s.active && c.canAfford}
                  disabled={!c.to || !c.canAfford}
                  onChange={(e) => setField(c.name, 'active', e.target.checked)}
                />
                Upgrade
              </label>
              <CostStatus
                active={!!c.s.active && c.canAfford}
                hasSelection={!!c.to && c.hasSteps}
                points={c.points}
                stepsInfo={` (${c.steps.length} steps)`}
                costs={c.costs}
                vault={vault}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}