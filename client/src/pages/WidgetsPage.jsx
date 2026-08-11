import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { formatNumber, SCORE_RULES } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import CostStatus from '../components/CostStatus';
import { LevelSelects } from '../components/LevelSelects';
import { heroWidgetImg, heroWidgetFallbacks, resourceImg } from '../utils/images';

export default function WidgetsPage() {
  const { data: widgetsData, loading: lw } = useGameData('widgets');
  const { data: heroesData, loading: lh } = useGameData('heroes');
  const { state, updateSection, setPageScore } = useApp();
  const heroWidgets = state.heroWidgets || {};
  const wState = state.widgets || {};

  const ssrHeroes = useMemo(() => {
    const list = heroesData?.Hero?.Heroes || [];
    return list.filter((h) => h.rarity === 'SSR');
  }, [heroesData]);

  const widgetRows = widgetsData?.Widgets || [];
  const levels = useMemo(() => {
    const set = new Set([0]);
    for (const row of widgetRows) {
      if (row.current_lvl != null) set.add(Number(row.current_lvl));
      if (row.target_lvl != null) set.add(Number(row.target_lvl));
    }
    if (set.size <= 1) for (let i = 0; i <= 10; i++) set.add(i);
    return Array.from(set).sort((a, b) => a - b);
  }, [widgetRows]);

  const setWidgetInv = (name, val) => {
    updateSection('heroWidgets', (prev) => ({ ...prev, [name]: val }));
  };

  const setUpgrade = (name, field, value) => {
    updateSection('widgets', (prev) => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [field]: value },
    }));
  };

  const totalActivePoints = useMemo(() => {
    let total = 0;
    const invLeft = {};
    for (const h of ssrHeroes) {
      invLeft[h.name] = parseFloat(heroWidgets[h.name]) || 0;
    }
    for (const h of ssrHeroes) {
      const s = wState[h.name] || {};
      if (!s.active) continue;
      const from = parseInt(s.from ?? '0', 10);
      const to = parseInt(s.to || '0', 10);
      if (to <= from) continue;
      let widgetsNeeded = 0;
      for (const row of widgetRows) {
        if (row.current_lvl >= from && row.target_lvl <= to) {
          widgetsNeeded += row.widgets || 0;
        }
      }
      const inv = invLeft[h.name] || 0;
      if (widgetsNeeded > inv) continue;
      invLeft[h.name] = inv - widgetsNeeded;
      total += widgetsNeeded * SCORE_RULES.widgets;
    }
    return total;
  }, [ssrHeroes, wState, widgetRows, heroWidgets]);

  useEffect(() => {
    setPageScore('widgets', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (lw || lh)
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );

  return (
    <div className="calculator-page">
      <div className="inventory-card">
        <div className="inventory-card-header">Hero widget inventory</div>
        <div className="hero-shards-grid">
          {ssrHeroes.map((h) => (
            <div className="hero-shard-item" key={h.name}>
              <AssetImg
                src={heroWidgetImg(h.name)}
                fallbacks={heroWidgetFallbacks(h.name)}
                size={48}
                alt={h.name}
              />
              <span className="hero-shard-name">{h.name}</span>
              <input
                type="text"
                className="hero-shard-input"
                placeholder="0"
                value={heroWidgets[h.name] ?? ''}
                onChange={(e) =>
                  setWidgetInv(h.name, e.target.value.replace(/[^0-9.]/g, ''))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="cards-grid">
        {ssrHeroes.map((h) => {
          const s = wState[h.name] || {};
          const from = parseInt(s.from ?? '0', 10);
          const to = parseInt(s.to || '0', 10);
          let widgetsNeeded = 0;
          if (to > from) {
            for (const row of widgetRows) {
              if (row.current_lvl >= from && row.target_lvl <= to) {
                widgetsNeeded += row.widgets || 0;
              }
            }
          }
          const inv = parseFloat(heroWidgets[h.name]) || 0;
          const canAfford = widgetsNeeded <= inv;
          const points = widgetsNeeded * SCORE_RULES.widgets;
          const left = inv - widgetsNeeded;
          return (
            <div className="item-card" key={h.name}>
              <div className="item-card-header">
                <AssetImg
                  src={heroWidgetImg(h.name)}
                  fallbacks={heroWidgetFallbacks(h.name)}
                  size={48}
                  alt={h.name}
                />
                <span>{h.name}</span>
              </div>
              <div className="item-card-body">
                <LevelSelects
                  levels={levels}
                  from={s.from ?? ''}
                  to={s.to ?? ''}
                  onFrom={(v) => setUpgrade(h.name, 'from', v)}
                  onTo={(v) => setUpgrade(h.name, 'to', v)}
                />
                <label
                  className="checkbox-label"
                  style={{ opacity: canAfford || !widgetsNeeded ? 1 : 0.5 }}
                >
                  <input
                    type="checkbox"
                    checked={!!s.active && canAfford}
                    disabled={widgetsNeeded > 0 && !canAfford}
                    onChange={(e) => setUpgrade(h.name, 'active', e.target.checked)}
                  />{' '}
                  Active
                </label>
                <CostStatus
                  active={!!s.active && canAfford}
                  hasSelection={to > from}
                  points={points}
                  emptyHint="Select current & target widget level"
                  lines={[
                    {
                      key: 'widgets',
                      label: 'widgets',
                      need: widgetsNeeded,
                      left,
                      deficit: left < 0,
                      img: resourceImg('widgets'),
                      fallbacks: [
                        heroWidgetImg(h.name),
                        ...heroWidgetFallbacks(h.name),
                      ],
                    },
                  ]}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
