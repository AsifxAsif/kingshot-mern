import { useMemo, useEffect, useCallback, useState } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, formatNumber, SCORE_RULES } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import { heroImg } from '../utils/images';

const FLOWERS_CONFIG = [
  { id: 0, values: ['0.1', '0.2', '0.3', '0.4', '0.5', '1.0'] },
  { id: 1, values: ['1.1', '1.2', '1.3', '1.4', '1.5', '2.0'] },
  { id: 2, values: ['2.1', '2.2', '2.3', '2.4', '2.5', '3.0'] },
  { id: 3, values: ['3.1', '3.2', '3.3', '3.4', '3.5', '4.0'] },
  { id: 4, values: ['4.1', '4.2', '4.3', '4.4', '4.5', '5.0'] },
];

const PETAL_PATH = 'M 75,24 L 87.5,51.5 L 75,73 L 62.5,51.5 Z';
const PETAL_ANGLES = [0, -60, -120, -180, -240, -300];
const MAX_ABS = FLOWERS_CONFIG.reduce((n, f) => n + f.values.length, 0) - 1;

function findAbsoluteIndex(flowerId, petalIndex) {
  let absoluteIdx = 0;
  for (let i = 0; i < flowerId; i++) absoluteIdx += FLOWERS_CONFIG[i].values.length;
  return absoluteIdx + petalIndex;
}

function valueAtAbsIdx(absIdx) {
  if (absIdx < 0) return null;
  let remaining = absIdx;
  for (const f of FLOWERS_CONFIG) {
    if (remaining < f.values.length) return f.values[remaining];
    remaining -= f.values.length;
  }
  return null;
}

function normalizeLevel(level) {
  const num = parseFloat(level);
  if (Number.isNaN(num)) return String(level);
  return String(num);
}

function getHeroUpgradeSteps(dataArray, fromLevel, toLevel) {
  if (!dataArray?.length) return [];
  const normalizedFrom = normalizeLevel(fromLevel);
  const normalizedTo = normalizeLevel(toLevel);
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < dataArray.length; i++) {
    const curr = dataArray[i].current_lvl ?? dataArray[i].current;
    const next = dataArray[i].target_lvl ?? dataArray[i].level ?? dataArray[i].target;
    if (curr !== undefined && normalizeLevel(curr) === normalizedFrom) startIndex = i;
    if (next !== undefined && normalizeLevel(next) === normalizedTo) {
      endIndex = i;
      break;
    }
  }
  if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
    return dataArray.slice(startIndex, endIndex + 1);
  }
  const nextMap = {};
  for (const item of dataArray) {
    const curr = item.current_lvl ?? item.current;
    const next = item.target_lvl ?? item.level ?? item.target;
    if (curr !== undefined && next !== undefined) {
      nextMap[normalizeLevel(curr)] = normalizeLevel(next);
    }
  }
  let current = normalizedFrom;
  const found = [];
  let safety = 0;
  while (current !== normalizedTo && safety < 100) {
    const next = nextMap[current];
    if (!next) break;
    const step = dataArray.find(
      (item) => normalizeLevel(item.current_lvl ?? item.current) === current
    );
    if (step) found.push(step);
    current = next;
    safety++;
  }
  return current === normalizedTo ? found : [];
}

function getGeneralShardType(rarity) {
  const r = String(rarity || '').toUpperCase();
  if (r === 'SSR' || r === 'MYTHIC' || r === 'LEGENDARY') return 'mythic_general_shard';
  if (r === 'SR' || r === 'EPIC') return 'epic_general_shard';
  return 'rare_general_shard';
}

function rarityClass(rarity) {
  const r = String(rarity || '').toUpperCase();
  if (r === 'SSR' || r === 'MYTHIC' || r === 'LEGENDARY') return 'tier-ssr';
  if (r === 'SR' || r === 'EPIC') return 'tier-sr';
  if (r === 'R' || r === 'RARE') return 'tier-r';
  return 'tier-default';
}

function FlowerRow({ maxIdx, onPetalClick, type }) {
  let remaining = maxIdx + 1;
  return (
    <div className="flowers-container" data-type={type}>
      {FLOWERS_CONFIG.map((flowerData, flowerIdx) => {
        const flowerLength = flowerData.values.length;
        let activeLimit = -1;
        if (remaining >= flowerLength) {
          activeLimit = flowerLength - 1;
          remaining -= flowerLength;
        } else if (remaining > 0) {
          activeLimit = remaining - 1;
          remaining = 0;
        }
        return (
          <div className="flower-wrapper" key={flowerData.id}>
            <svg viewBox="0 0 150 150" className="flower-svg">
              {flowerData.values.map((val, i) => {
                const absIdx = findAbsoluteIndex(flowerIdx, i);
                const selected = i <= activeLimit;
                return (
                  <path
                    key={val}
                    className={`petal${selected ? ' selected' : ''}`}
                    style={{ '--rotate': `${PETAL_ANGLES[i]}deg`, transformOrigin: '75px 75px' }}
                    d={PETAL_PATH}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPetalClick(type, absIdx, val);
                    }}
                  />
                );
              })}
              <circle className="center-core" cx="75" cy="75" r="4" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

export default function HeroesPage() {
  const { data, loading, error } = useGameData('heroes');
  const { state, updateSection, setPageScore, vault, remainingVault } = useApp();
  const maxGen = state.settings?.maxHeroGen ?? 7;
  const shards = state.heroShards || {};
  const heroesState = state.heroes || {};
  const flowerStates = state.heroFlowers || {};
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const heroes = useMemo(() => {
    const list = data?.Hero?.Heroes || [];
    return list.filter((h) => (h.generation || 1) <= maxGen);
  }, [data, maxGen]);

  const shardTable = data?.Hero?.['Hero Shards'] || [];

  const setShard = (name, val) => {
    updateSection('heroShards', (prev) => ({ ...prev, [name]: val }));
  };

  const setHeroField = (name, field, value) => {
    updateSection('heroes', (prev) => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [field]: value },
    }));
  };

  const setMaxGen = (v) => {
    updateSection('settings', (prev) => ({ ...prev, maxHeroGen: parseInt(v, 10) }));
  };

  const setFlower = useCallback(
    (heroName, type, absIdx, clickedValue) => {
      const prevFs = flowerStates[heroName] || { currentMaxIdx: -1, targetMaxIdx: -1 };

      if (type === 'targ') {
        if (prevFs.currentMaxIdx !== -1 && absIdx <= prevFs.currentMaxIdx) {
          showToast(
            `Target (${clickedValue}) cannot be ≤ current (${valueAtAbsIdx(prevFs.currentMaxIdx) ?? 'none'})`
          );
          return;
        }
        if (prevFs.targetMaxIdx === absIdx) {
          updateSection('heroFlowers', (prev) => ({
            ...prev,
            [heroName]: { ...prevFs, targetMaxIdx: -1 },
          }));
          setHeroField(heroName, 'active', false);
          return;
        }
      }

      updateSection('heroFlowers', (prev) => {
        const cur = { ...(prev[heroName] || { currentMaxIdx: -1, targetMaxIdx: -1 }) };

        if (type === 'curr') {
          if (cur.currentMaxIdx === absIdx) {
            cur.currentMaxIdx = -1;
            cur.targetMaxIdx = -1;
          } else {
            cur.currentMaxIdx = absIdx;
            if (absIdx >= MAX_ABS) {
              cur.targetMaxIdx = MAX_ABS;
            } else {
              cur.targetMaxIdx = absIdx + 1;
            }
          }
        } else {
          if (cur.targetMaxIdx === absIdx) cur.targetMaxIdx = -1;
          else cur.targetMaxIdx = absIdx;
        }

        return { ...prev, [heroName]: cur };
      });

      updateSection('heroes', (prev) => ({
        ...prev,
        [heroName]: { ...(prev[heroName] || {}), active: false },
      }));
    },
    [flowerStates, updateSection]
  );

  const calcForHero = useCallback(
    (hero, useGeneral, lockedGeneral = {}) => {
      const fs = flowerStates[hero.name] || { currentMaxIdx: -1, targetMaxIdx: -1 };
      const currentIdx = fs.currentMaxIdx;
      const targetIdx = fs.targetMaxIdx;
      if (targetIdx < 0) return null;
      if (currentIdx >= 0 && targetIdx <= currentIdx) return null;

      const from = currentIdx < 0 ? '0' : valueAtAbsIdx(currentIdx);
      const to = valueAtAbsIdx(targetIdx);
      if (!to) return null;

      const steps = getHeroUpgradeSteps(shardTable, from, to);
      if (!steps.length) {
        return { error: true, message: 'No upgrade path', stepPoints: 0 };
      }

      let heroShardsNeeded = 0;
      for (const step of steps) {
        if (step.shards) heroShardsNeeded += parseCost(step.shards);
      }

      const availableHeroShards = parseCost(shards[hero.name]);
      const heroShardsUsed = Math.min(availableHeroShards, heroShardsNeeded);
      const shortage = Math.max(0, heroShardsNeeded - availableHeroShards);
      const generalType = getGeneralShardType(hero.rarity);
      const generalPts = SCORE_RULES[generalType] || 0;
      const vaultTotal = parseCost(remainingVault?.[generalType]);
      const vaultLeft = Math.max(0, vaultTotal - (lockedGeneral[generalType] || 0));

      if (shortage === 0) {
        const stepPoints = heroShardsUsed * generalPts;
        return {
          error: false,
          heroShardsNeeded,
          heroShardsUsed,
          generalUsed: 0,
          generalType,
          shortage: 0,
          vaultLeft,
          stepPoints,
          from,
          to,
          needGeneral: false,
          canEnableGeneral: false,
        };
      }

      if (!useGeneral) {
        return {
          error: true,
          message: `Need ${shortage} more ${hero.name} shards`,
          heroShardsNeeded,
          heroShardsUsed,
          shortage,
          generalType,
          vaultLeft,
          stepPoints: 0,
          from,
          to,
          needGeneral: true,
          canEnableGeneral: vaultLeft > 0,
        };
      }

      const generalUsed = Math.min(shortage, vaultLeft);
      if (generalUsed < shortage) {
        return {
          error: true,
          message: `Need ${shortage} general shards, only ${vaultLeft} left in vault`,
          heroShardsNeeded,
          heroShardsUsed,
          generalUsed,
          generalType,
          shortage,
          vaultLeft,
          stepPoints: 0,
          from,
          to,
          needGeneral: true,
          canEnableGeneral: vaultLeft > 0,
        };
      }

      const stepPoints = (heroShardsUsed + generalUsed) * generalPts;
      return {
        error: false,
        heroShardsNeeded,
        heroShardsUsed,
        generalUsed,
        generalType,
        shortage,
        vaultLeft,
        stepPoints,
        from,
        to,
        needGeneral: true,
        canEnableGeneral: true,
      };
    },
    [flowerStates, shardTable, shards, remainingVault]
  );

  const previewByHero = useMemo(() => {
    const map = {};
    for (const h of heroes) {
      map[h.name] = calcForHero(h, false, {});
    }
    return map;
  }, [heroes, calcForHero]);

  const { totalActivePoints, lockedGeneral, activeResults } = useMemo(() => {
    const locked = {
      rare_general_shard: 0,
      epic_general_shard: 0,
      mythic_general_shard: 0,
    };
    const activeResults = {};
    let total = 0;
    for (const h of heroes) {
      const s = heroesState[h.name] || {};
      if (!s.active) continue;
      const useGen = !!s.useGeneral;
      const result = calcForHero(h, useGen, locked);
      activeResults[h.name] = result;
      if (!result || result.error) continue;
      if (result.generalUsed) {
        locked[result.generalType] = (locked[result.generalType] || 0) + result.generalUsed;
      }
      total += result.stepPoints || 0;
    }
    return { totalActivePoints: total, lockedGeneral: locked, activeResults };
  }, [heroes, heroesState, calcForHero]);

  useEffect(() => {
    setPageScore('heroes', totalActivePoints);
  }, [totalActivePoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading heroes…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      {toast && <div className="hero-toast hero-toast-error">{toast}</div>}
      <div className="buff-row" style={{ marginBottom: 12 }}>
        <div className="buff-field">
          <label>Latest generation</label>
          <select value={maxGen} onChange={(e) => setMaxGen(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="inventory-card">
        <div className="inventory-card-header">Hero-specific shards</div>
        <div className="hero-shards-grid">
          {heroes.map((h) => (
            <div className={`hero-shard-item ${rarityClass(h.rarity)}`} key={h.name}>
              <AssetImg src={heroImg(h.name)} size={40} />
              <span className="hero-shard-name" title={h.name}>{h.name}</span>
              <input
                type="text"
                className="hero-shard-input"
                placeholder="0"
                value={shards[h.name] ?? ''}
                onChange={(e) => setShard(h.name, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="hint">
        Hero-specific shards are used first. If short, enable <strong>General Shards</strong> to spend
        Rare / Epic / Mythic general shards from the Vault (by rarity: R→rare, SR→epic, SSR→mythic).
      </p>
      <div className="items-grid cards-grid">
        {heroes.map((h) => {
          const s = heroesState[h.name] || {};
          const fs = flowerStates[h.name] || { currentMaxIdx: -1, targetMaxIdx: -1 };
          const currVal = valueAtAbsIdx(fs.currentMaxIdx);
          const targVal = valueAtAbsIdx(fs.targetMaxIdx);
          const useGen = !!s.useGeneral;
          const generalType = getGeneralShardType(h.rarity);
          const vaultTotal = parseCost(remainingVault?.[generalType]);
          const preview = previewByHero[h.name];
          const result = s.active
            ? activeResults[h.name]
            : calcForHero(h, useGen, lockedGeneral);

          const shortage = preview?.shortage || 0;
          const hasEnoughHero = preview && !preview.error && shortage === 0;
          const canEnableGeneral = !!preview && shortage > 0 && vaultTotal > 0 && fs.targetMaxIdx >= 0;
          const generalDisabled = !canEnableGeneral;

          let status = 'Select current & target (petals)';
          if (result) {
            if (result.error) {
              status = result.message || 'Insufficient shards';
              if (result.needGeneral && result.canEnableGeneral && !useGen) {
                status += ` — enable General Shards (${generalType.replace(/_/g, ' ')})`;
              }
            } else {
              status = `${result.from} → ${result.to}: ${result.heroShardsUsed}/${result.heroShardsNeeded} hero shards`;
              if (result.generalUsed) {
                status += ` + ${result.generalUsed} ${generalType.replace(/_/g, ' ')}`;
              }
              status += ` → ${formatNumber(result.stepPoints)} pts`;
            }
          }

          const tier = rarityClass(h.rarity);
          const canUpgrade = result && !result.error;

          return (
            <div className={`item-card hero-card ${tier}`} key={h.name}>
              <div className="item-card-header">
                <AssetImg src={heroImg(h.name)} size={50} />
                <span>
                  {h.name}&apos;s Star Level (Gen {h.generation || 1})
                </span>
                <span className={`tier-badge ${tier}`}>
                  {String(h.rarity || 'R').toUpperCase()}
                </span>
              </div>
              <div className="item-card-body">
                <div className="level-controls-flowers">
                  <div className="flower-control-block">
                    <span className="control-label">
                      Current ({currVal ?? '0'})
                    </span>
                    <FlowerRow
                      maxIdx={fs.currentMaxIdx}
                      type="curr"
                      onPetalClick={(type, absIdx, val) => setFlower(h.name, type, absIdx, val)}
                    />
                  </div>
                  <div className="flower-control-block">
                    <span className="control-label">
                      Target {targVal ? `(${targVal})` : ''}
                    </span>
                    <FlowerRow
                      maxIdx={fs.targetMaxIdx}
                      type="targ"
                      onPetalClick={(type, absIdx, val) => setFlower(h.name, type, absIdx, val)}
                    />
                  </div>
                </div>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      className="checkbox"
                      type="checkbox"
                      checked={!!s.active && canUpgrade}
                      disabled={!canUpgrade}
                      onChange={(e) => setHeroField(h.name, 'active', e.target.checked)}
                    />{' '}
                    Upgrade
                  </label>
                  <label
                    className="checkbox-label"
                    style={{ opacity: generalDisabled ? 0.5 : 1 }}
                    title={
                      generalDisabled
                        ? hasEnoughHero
                          ? `Enough ${h.name} shards — general not needed`
                          : vaultTotal <= 0
                            ? `No ${generalType.replace(/_/g, ' ')}s in vault`
                            : 'Select target level first'
                        : `Spend ${generalType.replace(/_/g, ' ')}s from vault for the shortage`
                    }
                  >
                    <input
                      className="checkbox"
                      type="checkbox"
                      checked={!!useGen && canEnableGeneral}
                      disabled={generalDisabled}
                      onChange={(e) => {
                        setHeroField(h.name, 'useGeneral', e.target.checked);
                        setHeroField(h.name, 'active', false);
                      }}
                    />{' '}
                    General Shards
                  </label>
                </div>
                <div
                  className={`status-pane ${
                    s.active && result && !result.error
                      ? 'status-ok'
                      : result?.error
                        ? 'status-error'
                        : ''
                  }`}
                >
                  {status}
                  {result && !result.error && (
                    <div style={{ marginTop: 4, fontSize: '0.72rem', opacity: 0.85 }}>
                      Vault {generalType.replace(/_/g, ' ')}: {formatNumber(vaultTotal)}
                      {result.generalUsed ? ` · using ${result.generalUsed}` : ''}
                    </div>
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