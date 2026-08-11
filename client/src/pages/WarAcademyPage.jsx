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
import { ResearchBuffPanel } from '../components/BuffPanel';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { LevelSelects } from '../components/LevelSelects';
import { warAcademyImg } from '../utils/images';

const RES = ['bread', 'wood', 'stone', 'iron', 'gold', 'truegold', 'truegold_dust', 'tempered_truegold'];

export default function WarAcademyPage() {
  const { data, loading, error } = useGameData('war_academy');
  const {
    state,
    updateSection,
    setPageScore,
    setPageLockedCosts,
    remainingVaultExcluding,
  } = useApp();
  const vault = useMemo(
    () => remainingVaultExcluding('warAcademy'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const wa = state.warAcademy || {};

  const root = data?.['War Academy'] || data || {};
  const techNames = useMemo(
    () => Object.keys(root).filter((k) => Array.isArray(root[k])),
    [root]
  );

  const setField = (name, field, value) => {
    updateSection('warAcademy', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' || field === 'to') cur.active = false;
      return { ...prev, [name]: cur };
    });
  };

  const cards = useMemo(() => {
    const raw = techNames.map((name) => {
      const rows = root[name] || [];
      const levels = getLevelsFromArray(rows);
      const s = wa[name] || {};
      const from = s.from ?? '0';
      const to = s.to || '';
      const steps = to ? getUpgradeSteps(rows, from || '0', to) : [];
      const costs = {};
      let dust = 0;
      for (const step of steps) {
        for (const k of RES) {
          if (step[k] != null) costs[k] = (costs[k] || 0) + parseCost(step[k]);
        }
        dust += parseCost(step.truegold_dust);
      }
      Object.keys(costs).forEach((k) => {
        if (!costs[k]) delete costs[k];
      });
      const points = dust * SCORE_RULES.truegold_dust;
      return {
        id: name,
        name,
        levels,
        s,
        from,
        to,
        steps,
        costs,
        points,
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
  }, [techNames, root, wa, vault]);

  const totalActivePoints = useMemo(
    () => cards.reduce((s, c) => s + (c.active && c.canAfford ? c.points : 0), 0),
    [cards]
  );

  useEffect(() => {
    setPageLockedCosts(
      'warAcademy',
      sumActiveCosts(
        cards.map((c) => ({ id: c.id, costs: c.costs, active: c.active })),
        new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
      )
    );
  }, [cards, setPageLockedCosts]);

  useEffect(() => {
    setPageScore('warAcademy', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

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
      <ResearchBuffPanel />
      <div className="cards-grid">
        {cards.map((c) => (
          <div className="item-card" key={c.name}>
            <div className="item-card-header">
              <AssetImg src={warAcademyImg(c.name)} size={40} />
              <span>{c.name}</span>
            </div>
            <div className="item-card-body">
              <LevelSelects
                levels={c.levels}
                from={c.from ?? ''}
                to={c.to ?? ''}
                onFrom={(v) => setField(c.name, 'from', v)}
                onTo={(v) => setField(c.name, 'to', v)}
              />
              <label
                className="checkbox-label"
                style={{ opacity: c.canAfford || !c.to ? 1 : 0.5 }}
              >
                <input
                  type="checkbox"
                  checked={!!c.active && c.canAfford}
                  disabled={!c.to || (!c.canAfford && !c.active)}
                  onChange={(e) => setField(c.name, 'active', e.target.checked)}
                />{' '}
                Active
              </label>
              <CostStatus
                active={!!c.active && c.canAfford}
                hasSelection={!!c.to}
                points={c.points}
                stepsInfo={c.steps.length ? ` (${c.steps.length} steps)` : ''}
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
