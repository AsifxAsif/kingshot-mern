import { useEffect, useMemo } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { parseCost, parseTimeToSeconds, formatNumber, formatSecondsToTime, SCORE_RULES } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import { asset, resourceImg } from '../utils/images';

const RESOURCES = ['bread', 'wood', 'stone', 'iron'];

const GATHER_RATES = {
  bread: { rate: 3, per: 2500 },
  wood: { rate: 3, per: 2500 },
  stone: { rate: 3, per: 500 },
  iron: { rate: 3, per: 100 },
};

function getSkillTitle(resourceType) {
  const titles = {
    bread: "Olive's Forager's Luck",
    wood: "Forrest's Master Woodcutter",
    stone: "Edwin's Stone Mining",
    iron: "Seth's Craftmanship",
  };
  return titles[resourceType] || 'Skill Level';
}

function getSkillImage(resourceType) {
  const map = {
    bread: 'olive_foragers_luck.webp',
    wood: 'forrest_master_woodcutter.webp',
    stone: 'edwin_stone_mining.webp',
    iron: 'seth_craftmanship.webp',
  };
  return asset(map[resourceType] || 'olive_foragers_luck.webp');
}

function getNodeImage(resourceType) {
  return asset(`${resourceType || 'bread'}_node.webp`);
}

function getSkillBonus(skillLevel) {
  const bonuses = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20, 5: 25 };
  return bonuses[skillLevel] || 0;
}

function gatheringPoints(resourceAmount, resourceType) {
  const rate = GATHER_RATES[resourceType] || { rate: 3, per: 2500 };
  return Math.floor(resourceAmount / rate.per) * rate.rate;
}

function calculateGatheringTime(nodeData, skillLevel, speedBuffPercent = 0) {
  if (!nodeData) return { timeSeconds: 0, resourceAmount: 0, originalTime: 0, totalBonus: 0 };
  const originalTime = parseTimeToSeconds(nodeData.time);
  const resourceAmount = parseCost(nodeData.resource);
  const totalBonus = getSkillBonus(skillLevel) + (parseFloat(speedBuffPercent) || 0);
  let timeSeconds = originalTime;
  if (totalBonus > 0) {
    timeSeconds = Math.max(1, Math.ceil(originalTime / (1 + totalBonus / 100)));
  }
  return { timeSeconds, resourceAmount, originalTime, totalBonus };
}

export default function MiscPage() {
  const { data, loading, error } = useGameData('misc');
  const { state, updateSection, setPageScore, vault } = useApp();
  const misc = state.misc || {};
  const gatherCards = misc.gatheringCards || {};

  const setField = (field, value) => {
    updateSection('misc', (prev) => ({ ...prev, [field]: value }));
  };

  const setGatherCard = (id, field, value) => {
    updateSection('misc', (prev) => ({
      ...prev,
      gatheringCards: {
        ...(prev.gatheringCards || {}),
        [id]: { ...(prev.gatheringCards?.[id] || {}), [field]: value },
      },
    }));
  };

  const gathering = data?.Gathering || [];
  const marches = Math.min(Math.max(parseInt(misc.marchUnits || '1', 10) || 1, 1), 6);
  const cardIds = useMemo(() => Array.from({ length: marches }, (_, i) => String(i + 1)), [marches]);

  const getNodeData = (nodeLevel, resourceType) =>
    gathering.find(
      (item) =>
        parseInt(String(item.node).replace(/lvl\s*/i, ''), 10) === parseInt(nodeLevel, 10) &&
        String(item.item).toLowerCase() === String(resourceType).toLowerCase()
    );

  const spins = parseCost(misc.roulette || 0);
  const tokensInVault = parseCost(vault?.hero_roulette_token);
  const roulettePoints = spins * (SCORE_RULES.roulette || 8000);

  const bisonGrip = Math.min(parseInt(misc.bisonGrip || '0', 10) || 0, 2);
  const bisonResource = misc.bisonResource || 'bread';
  const bisonNode = misc.bisonNode || '1';
  const bisonNodeData = bisonGrip > 0 ? getNodeData(bisonNode, bisonResource) : null;
  const bisonResourceAmt = bisonNodeData ? parseCost(bisonNodeData.resource) : 0;
  const bisonPoints =
    bisonGrip > 0 && bisonNodeData
      ? gatheringPoints(bisonResourceAmt, bisonResource) * bisonGrip
      : 0;

  const cardsCalc = cardIds.map((id) => {
    const card = gatherCards[id] || {};
    const resource = card.resource || '';
    const node = card.node || '';
    const skill = parseInt(card.skill || '0', 10) || 0;
    const speed = parseFloat(card.speed || '0') || 0;
    const nodeData = resource && node ? getNodeData(node, resource) : null;
    const result = calculateGatheringTime(nodeData, skill, speed);
    const points = resource && nodeData ? gatheringPoints(result.resourceAmount, resource) : 0;
    return {
      id,
      card,
      resource,
      node,
      skill,
      speed,
      nodeData,
      ...result,
      points,
      skillBonus: getSkillBonus(skill),
      skillTitle: resource ? getSkillTitle(resource) : 'Skill Level',
      skillImg: getSkillImage(resource),
      nodeImg: getNodeImage(resource),
    };
  });

  const gatherCardsPoints = cardsCalc.reduce((s, c) => s + c.points, 0);
  const totalMiscPoints =
    (misc.rouletteActive ? roulettePoints : 0) +
    (misc.gatherActive ? gatherCardsPoints + bisonPoints : 0);

  useEffect(() => {
    setPageScore('misc', totalMiscPoints);
  }, [totalMiscPoints, setPageScore]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;
  if (error) return <div className="page-error"><p>{error}</p></div>;

  return (
    <div className="app-container">
      <div className="item-card" style={{ marginBottom: 16 }}>
        <div className="item-card-header">
          <AssetImg src={asset('hero_roulette.webp')} size={40} />
          <span>HERO ROULETTE</span>
        </div>
        <div className="item-card-body">
          <div className="buff-field" style={{ marginBottom: 12 }}>
            <label>Number of Spins</label>
            <input
              type="text"
              placeholder="e.g. 120 or 1.5K"
              value={misc.roulette || ''}
              onChange={(e) => setField('roulette', e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </div>
          <div
            style={{
              padding: 12,
              background: 'var(--lcd-bg, #1a1a1a)',
              borderRadius: 8,
              color: '#fff',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tokens used:</span>
              <span style={{ color: 'var(--lcd-glow, #4af205)', fontWeight: 700 }}>
                {formatNumber(spins)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Vault tokens:</span>
              <span style={{ color: 'var(--lcd-glow, #4af205)', fontWeight: 700 }}>
                {formatNumber(tokensInVault)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Points:</span>
              <span style={{ color: 'var(--lcd-glow, #4af205)', fontWeight: 700 }}>
                {formatNumber(roulettePoints)}
              </span>
            </div>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!!misc.rouletteActive}
              onChange={(e) => setField('rouletteActive', e.target.checked)}
            />
            Count roulette points
          </label>
        </div>
      </div>

      <div className="item-card" style={{ marginBottom: 16 }}>
        <div className="item-card-header">
          <AssetImg src={asset('gathering_speed.webp')} size={40} />
          <span>GATHERING SETTINGS</span>
        </div>
        <div className="item-card-body">
          <div className="buff-field">
            <label>March Units</label>
            <select
              value={misc.marchUnits || '1'}
              onChange={(e) => setField('marchUnits', e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <small>Number of gathering marches</small>
          </div>

          <div className="buff-field" style={{ marginTop: 12 }}>
            <label>
              <AssetImg src={asset('grip_of_the_titan.webp')} size={22} /> Bison Grip (uses)
            </label>
            <select value={String(bisonGrip)} onChange={(e) => setField('bisonGrip', e.target.value)}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
            <small>Daily max 2 rotations</small>
          </div>

          {bisonGrip > 0 && (
            <div className="buff-row" style={{ marginTop: 10 }}>
              <div className="buff-field">
                <label>Bison Grip Resource</label>
                <select
                  value={bisonResource}
                  onChange={(e) => setField('bisonResource', e.target.value)}
                >
                  {RESOURCES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="buff-field">
                <label>Bison Grip Node</label>
                <select value={bisonNode} onChange={(e) => setField('bisonNode', e.target.value)}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {bisonGrip > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 14px',
                background: 'var(--lcd-bg, #1a1a1a)',
                borderRadius: 8,
                textAlign: 'center',
                color: '#fff',
              }}
            >
              <strong>
                <AssetImg src={asset('grip_of_the_titan.webp')} size={24} /> Bison Grip Points:{' '}
              </strong>
              <span style={{ color: 'var(--lcd-glow, #4af205)', fontWeight: 700 }}>
                {formatNumber(bisonPoints)}
              </span>
            </div>
          )}

          <label className="checkbox-label" style={{ marginTop: 12, display: 'block' }}>
            <input
              type="checkbox"
              checked={!!misc.gatherActive}
              onChange={(e) => setField('gatherActive', e.target.checked)}
            />
            Count gathering + bison points
          </label>
          <div className="status-pane" style={{ marginTop: 8 }}>
            March points: {formatNumber(gatherCardsPoints)} · Bison: {formatNumber(bisonPoints)} ·
            Total: {formatNumber(gatherCardsPoints + bisonPoints)}
          </div>
        </div>
      </div>

      <div className="items-grid cards-grid">
        {cardsCalc.map((c) => (
          <div className="item-card gathering-card" key={c.id} data-card-id={c.id}>
            <div className="item-card-header">
              <AssetImg src={c.nodeImg} size={40} />
              <span>Gathering March {parseInt(c.id, 10)}</span>
            </div>
            <div className="item-card-body">
              <div className="buff-field">
                <label>
                  <AssetImg src={resourceImg(c.resource || 'bread')} size={22} /> Resource Type
                </label>
                <select
                  value={c.resource}
                  onChange={(e) => setGatherCard(c.id, 'resource', e.target.value)}
                >
                  <option value="">Resource Type</option>
                  {RESOURCES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="buff-field">
                <label>
                  <AssetImg src={c.nodeImg} size={22} /> Node Level
                </label>
                <select
                  value={c.node}
                  onChange={(e) => setGatherCard(c.id, 'node', e.target.value)}
                >
                  <option value="">Node Level</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="buff-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AssetImg src={c.skillImg} size={28} />
                  {c.skillTitle}
                </label>
                <select
                  value={String(c.skill)}
                  onChange={(e) => setGatherCard(c.id, 'skill', e.target.value)}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Level {n} (+{getSkillBonus(n)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="buff-field">
                <label>
                  <AssetImg src={asset('gathering_speed.webp')} size={22} /> Gathering Speedup (%)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50"
                  value={c.card.speed ?? ''}
                  onChange={(e) => setGatherCard(c.id, 'speed', e.target.value)}
                  style={{ textAlign: 'center' }}
                />
                <small>Resource-specific speed buff %</small>
              </div>

              <div className={`status-pane ${c.points > 0 ? 'status-ok' : ''}`}>
                {!c.nodeData ? (
                  'Select resource type, node level, and skill level'
                ) : (
                  <>
                    <strong>
                      <AssetImg src={resourceImg(c.resource)} size={22} />{' '}
                      {c.resource.charAt(0).toUpperCase() + c.resource.slice(1)} - Level {c.node}
                    </strong>
                    <div>
                      Resource: <strong>{formatNumber(c.resourceAmount)}</strong>
                    </div>
                    <div>
                      <AssetImg src={c.skillImg} size={20} /> {c.skillTitle}: Level {c.skill} (+
                      {c.skillBonus}%)
                    </div>
                    <div>Speed Buff: +{c.speed}%</div>
                    <div>Total Bonus: +{c.totalBonus}%</div>
                    <div>
                      Time: <strong>{formatSecondsToTime(c.timeSeconds)}</strong>
                      {c.originalTime !== c.timeSeconds && (
                        <span style={{ opacity: 0.7 }}>
                          {' '}
                          (original: {formatSecondsToTime(c.originalTime)})
                        </span>
                      )}
                    </div>
                    <div>
                      Points: <strong>+{formatNumber(c.points)}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}