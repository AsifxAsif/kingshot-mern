import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { formatNumber, SCORE_RULES, getUpgradeSteps, sortLevels } from '../utils/calc';
import { computeAffordability } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import { heroWidgetImg } from '../utils/images';

export default function WidgetsPage() {
  const { data: widgetsData, loading: lw } = useGameData('widgets');
  const { data: heroesData, loading: lh } = useGameData('heroes');
  const { state, updateSection, setPageScore, vault } = useApp();
  const heroWidgets = state.heroWidgets || {};
  const wState = state.widgets || {};

  const ssrHeroes = useMemo(() => {
    const list = heroesData?.Hero?.Heroes || [];
    return list.filter((h) => h.rarity === 'SSR');
  }, [heroesData]);

  const widgetRows = widgetsData?.Widgets || [];
  const levels = useMemo(() => {
    const set = new Set();
    for (const row of widgetRows) {
      if (row.current_lvl !== undefined && row.current_lvl !== null) set.add(Number(row.current_lvl));
      if (row.target_lvl !== undefined && row.target_lvl !== null) set.add(Number(row.target_lvl));
    }
    if (set.size <= 1) {
      for (let i = 0; i <= 10; i++) set.add(i);
    }
    const result = sortLevels(Array.from(set));
    return result.length ? result : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }, [widgetRows]);

  const setWidgetInv = (name, val) => {
    updateSection('heroWidgets', (prev) => ({ ...prev, [name]: val }));
  };

  const setUpgrade = (name, field, value) => {
    updateSection('widgets', (prev) => {
      const cur = { ...(prev[name] || {}), [field]: value };
      if (field === 'from' || field === 'to') {
        cur.active = false;
      }
      return { ...prev, [name]: cur };
    });
  };

  const cards = useMemo(() => {
    return ssrHeroes.map((h) => {
      const s = wState[h.name] || {};
      const from = s.from !== undefined && s.from !== '' ? String(s.from) : '';
      const to = s.to !== undefined && s.to !== '' ? String(s.to) : '';
      const fromNum = from !== '' ? parseInt(from, 10) : 0;
      const toNum = to !== '' ? parseInt(to, 10) : 0;
      let widgetsNeeded = 0;
      if (toNum > fromNum) {
        const steps = getUpgradeSteps(widgetRows, fromNum, toNum);
        for (const step of steps) {
          widgetsNeeded += step.widgets || 0;
        }
      }
      const inv = parseFloat(heroWidgets[h.name]) || 0;
      const points = widgetsNeeded * SCORE_RULES.widgets;
      const costs = { widgets: widgetsNeeded };
      const { canAfford } = computeAffordability(costs, vault);
      const hasSelection = toNum > fromNum && widgetsNeeded > 0;
      return { ...h, s, from, to, fromNum, toNum, widgetsNeeded, inv, points, costs, canAfford, hasSelection };
    });
  }, [ssrHeroes, wState, widgetRows, heroWidgets, vault]);

  const totalActivePoints = useMemo(() => {
    let total = 0;
    for (const c of cards) {
      if (c.s.active && c.canAfford) total += c.points;
    }
    return total;
  }, [cards]);

  useEffect(() => {
    setPageScore('widgets', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (lw || lh) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;

  return (
    <div className="app-container">
      <div className="inventory-card">
        <div className="inventory-card-header">Hero widget inventory</div>
        <div className="hero-shards-grid">
          {ssrHeroes.map((h) => (
            <div className="hero-shard-item" key={h.name}>
              <AssetImg src={heroWidgetImg(h.name)} size={48} />
              <span className="hero-shard-name">{h.name}</span>
              <input
                type="text"
                className="hero-shard-input"
                placeholder="0"
                value={heroWidgets[h.name] ?? ''}
                onChange={(e) => setWidgetInv(h.name, e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="items-grid cards-grid">
        {cards.map((c) => (
          <div className="item-card" key={c.name}>
            <div className="item-card-header">
              <AssetImg src={heroWidgetImg(c.name)} size={40} />
              <span>{c.name}</span>
            </div>
            <div className="item-card-body">
              <LevelSelects
                levels={levels}
                from={c.from}
                to={c.to}
                onFrom={(v) => setUpgrade(c.name, 'from', v)}
                onTo={(v) => setUpgrade(c.name, 'to', v)}
              />
              <div className="checkbox-group">
                <label className="checkbox-label" style={{ opacity: c.canAfford && c.hasSelection ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={!!c.s.active && c.canAfford}
                    disabled={!c.hasSelection || !c.canAfford}
                    onChange={(e) => setUpgrade(c.name, 'active', e.target.checked)}
                  />
                  Upgrade
                </label>
              </div>
              <CostStatus
                active={!!c.s.active && c.canAfford}
                hasSelection={c.hasSelection}
                points={c.points}
                stepsInfo=""
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