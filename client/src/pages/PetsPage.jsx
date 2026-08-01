import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, getUpgradeSteps, getLevelsFromArray, SCORE_RULES } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { computeAffordability } from '../utils/resources';
import { LevelSelects } from '../components/LevelSelects';
import { petImg } from '../utils/images';

const RES = [
  'pet_food', 'common_taming_mark', 'advanced_taming_mark',
  'growth_manual', 'nutrient_potion', 'bread', 'wood',
];

export default function PetsPage() {
  const { data, loading, error } = useGameData('pets');
  const { state, updateSection, setPageScore } = useApp();
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

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const name of petNames) {
      const s = petsState[name] || {};
      if (!s.active || !s.to) continue;
      const rows = root[name] || [];
      const steps = getUpgradeSteps(rows, s.from ?? '0', s.to);
      let adv = 0, common = 0;
      for (const step of steps) {
        adv += parseCost(step.advanced_taming_mark);
        common += parseCost(step.common_taming_mark);
      }
      total += adv * SCORE_RULES.advanced_taming_mark + common * SCORE_RULES.common_taming_mark + steps.length * (SCORE_RULES.pet_advancement_score || 0);
    }
    return total;
  }, [petNames, petsState, root]);

  useEffect(() => { setPageScore('pets', totalActivePoints); }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="calculator-page">
      <h2>Pets</h2>
      <div className="cards-grid">
        {petNames.map((name) => {
          const rows = root[name] || [];
          const levels = getLevelsFromArray(rows, ['level', 'current_lvl', 'current', 'target_lvl', 'target'], { includeZero: true });
          const s = petsState[name] || {};
          const steps = s.to ? getUpgradeSteps(rows, s.from ?? '0', s.to) : [];
          const costs = {};
          let adv = 0;
          let common = 0;
          for (const step of steps) {
            for (const k of RES) {
              if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
            }
            adv += parseCost(step.advanced_taming_mark);
            common += parseCost(step.common_taming_mark);
          }
          const points =
            adv * SCORE_RULES.advanced_taming_mark +
            common * SCORE_RULES.common_taming_mark +
            steps.length * (SCORE_RULES.pet_advancement_score || 0);
          return (
            <div className="item-card" key={name}>
              <div className="item-card-header"><AssetImg src={petImg(name)} size={40} /><span>{name}</span></div>
              <div className="item-card-body">
                <LevelSelects
                levels={levels}
                from={s.from ?? ""}
                to={s.to ?? ""}
                onFrom={(v) => setField(name, 'from', v)}
                onTo={(v) => setField(name, 'to', v)}
              />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!s.active}
                    onChange={(e) => setField(name, 'active', e.target.checked)}
                  />{' '}
                  Active
                </label>
                <div className="status-pane">
                  {steps.length === 0 ? (
                    'Select target'
                  ) : (
                    <>
                      <div>{steps.length} step(s) · pts {formatNumber(points)}</div>
                      {Object.entries(costs)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <div key={k}>{k}: {formatNumber(v)}</div>
                        ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
