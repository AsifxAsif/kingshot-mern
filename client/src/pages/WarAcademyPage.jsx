import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, getUpgradeSteps, getLevelsFromArray, SCORE_RULES } from '../utils/calc';
import { ResearchBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { warAcademyImg } from '../utils/images';

const RES = ['bread', 'wood', 'stone', 'iron', 'truegold', 'truegold_dust', 'tempered_truegold'];

export default function WarAcademyPage() {
  const { data, loading, error } = useGameData('war_academy');
  const { state, updateSection, setPageScore } = useApp();
  const wa = state.warAcademy || {};

  const techNames = useMemo(() => {
    const root = data?.['War Academy'] || data || {};
    return Object.keys(root).filter((k) => Array.isArray(root[k]));
  }, [data]);

  const root = data?.['War Academy'] || data || {};

  const setField = (name, field, value) => {
    updateSection('warAcademy', (prev) => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [field]: value },
    }));
  };

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const name of techNames) {
      const s = wa[name] || {};
      if (!s.active || !s.to) continue;
      const rows = root[name] || [];
      const steps = getUpgradeSteps(rows, s.from ?? '0', s.to);
      for (const step of steps) {
        total += parseCost(step.truegold_dust) * SCORE_RULES.truegold_dust;
      }
    }
    return total;
  }, [techNames, wa, root]);

  useEffect(() => { setPageScore('warAcademy', totalActivePoints); }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="calculator-page">
      <ResearchBuffPanel />
      <div className="cards-grid">
        {techNames.map((name) => {
          const rows = root[name] || [];
          const levels = getLevelsFromArray(rows);
          const s = wa[name] || {};
          const steps = s.to ? getUpgradeSteps(rows, s.from ?? '0', s.to) : [];
          const costs = {};
          let dust = 0;
          for (const step of steps) {
            for (const k of RES) {
              if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
            }
            dust += parseCost(step.truegold_dust);
          }
          const points = dust * SCORE_RULES.truegold_dust;
          return (
            <div className="item-card" key={name}>
              <div className="item-card-header"><AssetImg src={warAcademyImg(name)} size={40} /><span>{name}</span></div>
              <div className="item-card-body">
                <LevelSelects
                  levels={levels}
                  from={s.from ?? ''}
                  to={s.to ?? ''}
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
                      {Object.entries(costs).map(([k, v]) => (
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
