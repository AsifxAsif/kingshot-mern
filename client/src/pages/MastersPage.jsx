import { useMemo, useEffect } from 'react';
import { useGameData } from '../hooks/useGameData';
import { useApp } from '../context/AppContext';
import { useScoreRules } from '../hooks/useScoreRules';
import { usePublishPageScore } from '../hooks/usePublishPageScore';
import { parseCost, formatNumber, formatSecondsToTime } from '../utils/calc';
import { sequentialAfford, sumActiveCosts, vaultAmount } from '../utils/resources';
import CostStatus from '../components/CostStatus';
import AssetImg from '../components/AssetImg';
import { LevelSelects } from '../components/LevelSelects';
import PrereqList from '../components/PrereqList';
import {
  resourceImg,
  resourceImgFallbacks,
  masterImg,
  masterImgFallbacks,
  masterTalentImg,
  masterTalentImgFallbacks,
  masterSkillImg,
  masterSkillImgFallbacks,
  masterAffinityImg,
  masterAffinityImgFallbacks,
} from '../utils/images';

/** Affinity gift items → affinity points */
function levelNum(v) {
  if (v == null || v === '') return 0;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Talent rank L (1–11) needs Affinity (L-1)*10 */
function talentAffinityReq(talentLevel) {
  const lv = levelNum(talentLevel);
  if (lv <= 0) return 0;
  if (lv >= 11) return 100;
  // Rank R unlocks at Affinity R×10 (rank 1 @ 10, rank 9 @ 90, rank 10 @ 100)
  return lv * 10;
}

/** Affinity A → talent rank (1–11). Rank auto-rises every 10 affinity. */
function talentLevelFromAffinity(affLevel) {
  const a = levelNum(affLevel);
  // Current talent rank already earned at this affinity (not the next unlock)
  if (a >= 100) return '11';
  return String(Math.min(10, Math.floor(a / 10))); // 0–9 → 0, 90–99 → 9
}

export const AFFINITY_ITEMS = [
  { id: 'elite_spices', label: 'Elite Spices', points: 1000, placeholder: '10' },
  { id: 'silver_goblet', label: 'Silver Goblet', points: 100, placeholder: '20' },
  { id: 'copper_horn', label: 'Copper Horn', points: 10, placeholder: '50' },
];

function extractMastersList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.masters)) return data.masters;
  if (Array.isArray(data.Masters)) return data.Masters;
  if (data.data) return extractMastersList(data.data);
  if (data.id && data.affinity) return [data];
  return [];
}

function parseEmblemFromAdvancement(adv) {
  if (!adv) return 0;
  const m = String(adv).match(/(\d+)\s*Emblem/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Extract status name from "5 Emblems · Acquaintance 1" */
function advancementStatusName(adv) {
  if (!adv) return '';
  const parts = String(adv).split('·');
  const name = (parts.length > 1 ? parts.slice(1).join('·') : parts[0]).trim();
  return name || String(adv).trim();
}

/**
 * Affinity ladder as separate steps:
 *   0,1,…,9, 10, Acquaintance 1, 11,…, 90, Close 3, 91,…, 100, Kindred Soul
 * Numeric steps cost affinity points; status steps cost emblems only.
 */
function affinitySteps(master) {
  const rows = [...(master?.affinity || [])].sort(
    (a, b) => (Number(a.level) || 0) - (Number(b.level) || 0)
  );
  const steps = [];
  for (const row of rows) {
    const lv = Number(row.level) || 0;
    const label = lv === 100 ? '100' : String(lv);
    steps.push({
      key: `lv_${lv}`,
      kind: 'level',
      level: lv,
      label,
      affinityCost: parseCost(row.affinityCost),
      emblems: 0,
    });
    if (row.advancement) {
      const status = advancementStatusName(row.advancement);
      steps.push({
        key: `adv_${lv}`,
        kind: 'advancement',
        level: lv,
        label: status,
        affinityCost: 0,
        emblems: parseEmblemFromAdvancement(row.advancement),
      });
    }
  }
  if (!steps.length) {
    for (let i = 0; i <= 100; i++) {
      steps.push({
        key: `lv_${i}`,
        kind: 'level',
        level: i,
        label: String(i),
        affinityCost: 0,
        emblems: 0,
      });
    }
  }
  return steps;
}

function affinityLevelKeys(master) {
  return affinitySteps(master).map((s) => s.label);
}

function stepIndex(steps, value) {
  if (value == null || value === '') return -1;
  const v = String(value);
  let idx = steps.findIndex((s) => s.label === v || s.key === v);
  if (idx >= 0) return idx;
  // legacy: pure number stored before status split
  const n = levelNum(v);
  idx = steps.findIndex((s) => s.kind === 'level' && s.level === n);
  return idx;
}

/** Sum affinity points + emblems for steps (fromIdx, toIdx] */
function affinityRangeCost(master, fromVal, toVal) {
  const steps = affinitySteps(master);
  const fromIdx = stepIndex(steps, fromVal);
  const toIdx = stepIndex(steps, toVal);
  if (fromIdx < 0 || toIdx < 0 || toIdx <= fromIdx) {
    return { points: 0, emblems: 0 };
  }
  let points = 0;
  let emblems = 0;
  for (let i = fromIdx + 1; i <= toIdx; i++) {
    points += steps[i].affinityCost || 0;
    emblems += steps[i].emblems || 0;
  }
  return { points, emblems };
}

function affinityLevels(master) {
  return affinityLevelKeys(master);
}

/** Status step (Acquaintance 1, Casual 1, …) tied to affinity milestone N */
function affinityStatusStep(master, milestoneLevel) {
  const n = levelNum(milestoneLevel);
  const steps = affinitySteps(master);
  return steps.find((s) => s.kind === 'advancement' && s.level === n) || null;
}

/** Label shown for an "Affinity N" requirement → status name when available */
function affinityReqLabel(master, milestoneLevel) {
  const step = affinityStatusStep(master, milestoneLevel);
  if (step) return step.label;
  return `Affinity ${levelNum(milestoneLevel)}`;
}

/**
 * Skills unlock at the *status* step after milestone N (e.g. Affinity 40 → Casual 1),
 * not merely at numeric level N.
 */
function meetsAffinityStatusReq(master, currentValue, milestoneLevel) {
  const steps = affinitySteps(master);
  const curIdx = stepIndex(steps, currentValue);
  if (curIdx < 0) return false;
  const status = affinityStatusStep(master, milestoneLevel);
  if (status) {
    const reqIdx = steps.findIndex((s) => s.key === status.key);
    return reqIdx >= 0 && curIdx >= reqIdx;
  }
  // No status step — fall back to numeric level index
  const lvIdx = steps.findIndex(
    (s) => s.kind === 'level' && s.level === levelNum(milestoneLevel)
  );
  return lvIdx >= 0 && curIdx >= lvIdx;
}

function parseAffinityReqNumber(text) {
  const m = String(text || '').match(/Affinity\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}


/** Numeric affinity rank for prereqs/talent (status steps count as their milestone level) */
function affinityNumericValue(master, value) {
  if (value == null || value === '') return 0;
  const steps = affinitySteps(master);
  const idx = stepIndex(steps, value);
  if (idx >= 0) return steps[idx].level;
  return levelNum(value);
}


function skillLevels(skill) {
  const lvls = (skill?.levels || []).map((r) => String(r.level));
  if (lvls.length && !lvls.includes('0')) return ['0', ...lvls];
  return lvls.length ? lvls : ['0', '1'];
}

function talentLevels(master) {
  const lvls = (master?.talent?.levels || []).map((r) => String(r.level));
  if (lvls.length && !lvls.includes('0')) return ['0', ...lvls];
  return lvls.length ? lvls : ['0', '1'];
}

/** Sum affinity-point costs for levels (from, to] */
function affinityPointsCost(master, fromLv, toLv) {
  const from = levelNum(fromLv);
  const to = levelNum(toLv);
  if (to <= from) return 0;
  let total = 0;
  for (const row of master.affinity || []) {
    const lv = Number(row.level) || 0;
    if (lv > from && lv <= to) total += parseCost(row.affinityCost);
  }
  return total;
}

function affinityEmblemCost(master, fromLv, toLv) {
  const from = levelNum(fromLv);
  const to = levelNum(toLv);
  if (to <= from) return 0;
  let total = 0;
  for (const row of master.affinity || []) {
    const lv = Number(row.level) || 0;
    if (lv > from && lv <= to) total += parseEmblemFromAdvancement(row.advancement);
  }
  return total;
}

/** Greedy: spend highest-value affinity items first */
function affinityPointsToItems(pointsNeeded) {
  let left = Math.max(0, Math.ceil(Number(pointsNeeded) || 0));
  const costs = {};
  const elite = Math.floor(left / 1000);
  if (elite > 0) {
    costs.elite_spices = elite;
    left -= elite * 1000;
  }
  const silver = Math.floor(left / 100);
  if (silver > 0) {
    costs.silver_goblet = silver;
    left -= silver * 100;
  }
  const copper = Math.ceil(left / 10);
  if (copper > 0) {
    costs.copper_horn = copper;
    left = 0;
  }
  return costs;
}

function skillUpgradeCosts(skill, fromLv, toLv) {
  const from = levelNum(fromLv);
  const to = levelNum(toLv);
  let manuscripts = 0;
  let learningSeconds = 0;
  for (const row of skill?.levels || []) {
    const lv = Number(row.level) || 0;
    if (lv > from && lv <= to) {
      manuscripts += parseCost(row.manuscripts);
      learningSeconds += parseCost(row.learningXP);
    }
  }
  return { manuscripts, learningSeconds };
}

/** Total Learning XP (seconds) to fully train a skill (all levels). */
function skillMaxLearningXP(skill) {
  let total = 0;
  for (const row of skill?.levels || []) {
    total += parseCost(row.learningXP);
  }
  return total;
}

/** Cumulative Learning XP required to reach skill level `toLv` (from 0). */
function skillLearningXPToReach(skill, toLv) {
  const to = levelNum(toLv);
  let total = 0;
  for (const row of skill?.levels || []) {
    const lv = Number(row.level) || 0;
    if (lv > 0 && lv <= to) total += parseCost(row.learningXP);
  }
  return total;
}

/**
 * Remaining Learning XP for from→to given skill-wide learned XP (0…max).
 */
function skillRemainingLearningXP(skill, fromLv, toLv, learnedXP) {
  const from = levelNum(fromLv);
  const to = levelNum(toLv);
  if (to <= from) return 0;
  const needStart = skillLearningXPToReach(skill, from);
  const needEnd = skillLearningXPToReach(skill, to);
  const learned = Math.max(0, parseCost(learnedXP));
  return Math.max(0, needEnd - Math.max(needStart, learned));
}

function skillLevelAffinityReq(skill, targetLv) {
  const lv = levelNum(targetLv);
  if (lv <= 0) return 0;
  let req = 0;
  const unlock = skill?.unlock || '';
  const um = String(unlock).match(/Affinity\s*(\d+)/i);
  if (um) req = Math.max(req, parseInt(um[1], 10));
  for (const row of skill?.levels || []) {
    const rowLv = Number(row.level) || 0;
    if (rowLv > 0 && rowLv <= lv && row.requirement) {
      const m = String(row.requirement).match(/Affinity\s*(\d+)/i);
      if (m) req = Math.max(req, parseInt(m[1], 10));
    }
  }
  return req;
}

function emblemVaultKey(masterId) {
  return `master_emblem_${masterId}`;
}

/** Spend master-specific emblems first, then general_emblem */
function splitEmblemCost(masterId, need, emblemsMap, useGeneral) {
  const needN = Math.max(0, Math.ceil(Number(need) || 0));
  if (!needN) return {};
  const eKey = emblemVaultKey(masterId);
  const specificHave = Math.max(0, parseCost(emblemsMap?.[masterId]));
  const usedSpecific = Math.min(needN, specificHave);
  const costs = {};
  if (usedSpecific > 0) costs[eKey] = usedSpecific;
  const rest = needN - usedSpecific;
  if (rest > 0) {
    if (useGeneral) costs.general_emblem = rest;
    else costs[eKey] = (costs[eKey] || 0) + rest; // still required on master emblem (shows short)
  }
  return costs;
}


/** Inventory strip at top of Masters page */
function MastersInventory({ mastersList, vault, updateVaultField, emblems, setEmblem }) {
  const totalAffinityPts = AFFINITY_ITEMS.reduce(
    (s, it) => s + vaultAmount(vault, it.id) * it.points,
    0
  );

  return (
    <div className="item-card" style={{ marginBottom: 16, gridColumn: '1 / -1' }}>
      <div className="item-card-header">
        <span>Masters inventory</span>
      </div>
      <div className="item-card-body">
        <h3 className="vault-subhead" style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
          Affinity gifts (Vault)
        </h3>
        <div className="vault-grid" style={{ marginBottom: 8 }}>
          {AFFINITY_ITEMS.map((it) => (
            <div
              className="vault-item"
              key={it.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div className="vault-label">
                <AssetImg
                  src={resourceImg(it.id)}
                  fallbacks={resourceImgFallbacks(it.id)}
                  size={36}
                  alt={it.label}
                />
                <label htmlFor={`m-${it.id}`}>{it.label}</label>
              </div>
              <small style={{ opacity: 0.7, marginBottom: 4 }}>
                {formatNumber(it.points)} affinity each
              </small>
              <input
                id={`m-${it.id}`}
                type="text"
                placeholder={it.placeholder}
                value={vault?.[it.id] ?? ''}
                onChange={(e) => updateVaultField(it.id, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: 14 }}>
          Total affinity points available:{' '}
          <strong>{formatNumber(totalAffinityPts)}</strong>
        </div>

        <h3 className="vault-subhead" style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
          Master emblems (per master)
        </h3>
        <div className="vault-grid">
          {mastersList.map((m) => {
            const id = String(m.id || m.name || '').toLowerCase();
            return (
              <div
                className="vault-item"
                key={id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <div className="vault-label">
                  <AssetImg
                    src={masterImg(id)}
                    fallbacks={masterImgFallbacks(id)}
                    size={36}
                    alt={m.name || id}
                  />
                  <label htmlFor={`emblem-${id}`}>{m.name || id} emblems</label>
                </div>
                <input
                  id={`emblem-${id}`}
                  type="text"
                  placeholder="0"
                  value={emblems[id] ?? ''}
                  onChange={(e) => setEmblem(id, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One upgrade row inside a master card */
function UpgradeRow({
  c,
  setField,
  vault,
}) {
  const atMax =
    c.levels.length > 0 &&
    String(c.from ?? '0') === String(c.levels[c.levels.length - 1]);

  return (
    <div
      className="item-card group-card-item"
      style={{ margin: 0, boxShadow: 'none' }}
    >
      <div className="item-card-header">
        <AssetImg
          src={
            c.kind === 'affinity'
              ? masterAffinityImg(c.masterId)
              : c.kind === 'talent'
                ? masterTalentImg(c.masterId)
                : c.kind === 'skill'
                  ? masterSkillImg(c.masterId, c.title)
                  : masterImg(c.masterId)
          }
          fallbacks={
            c.kind === 'affinity'
              ? masterAffinityImgFallbacks(c.masterId)
              : c.kind === 'talent'
                ? masterTalentImgFallbacks(c.masterId)
                : c.kind === 'skill'
                  ? masterSkillImgFallbacks(c.masterId, c.title)
                  : masterImgFallbacks(c.masterId)
          }
          size={40}
          alt={c.title}
        />
        <span>
          {c.title}
          {c.skillType ? ` (${c.skillType})` : ''}
        </span>
      </div>
      <div className="item-card-body">
        {c.unlockUnmet ? (
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: 4, color: '#c0392b' }}>
            Unlock: {c.unlockLabel || c.unlock}
          </div>
        ) : null}
        {c.affinityPtsNeeded > 0 ? (
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: 4 }}>
            Affinity points needed: {formatNumber(c.affinityPtsNeeded)}
          </div>
        ) : null}

        {c.kind === 'talent' ? (
          <div className="level-selects" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label>
              Current Level{' '}
              <select value={c.from ?? ''} disabled>
                {(c.levels || []).map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </label>
            <label>
              Target Level{' '}
              <select value={c.to ?? ''} disabled>
                <option value="">—</option>
                {(c.levels || []).map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <LevelSelects
            levels={c.levels}
            from={c.from ?? ''}
            to={c.to ?? ''}
            onFrom={(v) => setField(c.masterId, c.fieldKey, 'from', v)}
            onTo={(v) => setField(c.masterId, c.fieldKey, 'to', v)}
            preserveOrder={c.kind === 'affinity'}
          />
        )}

        {c.prereqItems?.length > 0 && c.to ? <PrereqList items={c.prereqItems} /> : null}

        {c.kind === 'skill' && c.maxLearningXP > 0 ? (
          <div className="learning-xp-block">
            <div className="learning-xp-summary">
              Skill Learning XP:{' '}
              <strong>{formatSecondsToTime(c.learnedXP || 0)}</strong>
              {' / '}
              <strong>{formatSecondsToTime(c.maxLearningXP)}</strong>
              {c.to && c.learningSeconds > 0 ? (
                <>
                  {' '}
                  · this upgrade needs{' '}
                  <strong>{formatSecondsToTime(c.learningSeconds)}</strong>
                  {c.remainingSeconds < c.learningSeconds ? (
                    <>
                      {' '}
                      (remaining{' '}
                      <strong>{formatSecondsToTime(c.remainingSeconds)}</strong>)
                    </>
                  ) : null}
                </>
              ) : null}
              {c.speedupOn && c.remainingSeconds > 0
                ? ` → ${formatNumber(c.speedupMins)} min speedup`
                : null}
            </div>
            <label className="learning-xp-label" htmlFor={`lxp-${c.id}`}>
              Learned toward this skill (0 – max)
            </label>
            <div className="learning-xp-controls">
              <input
                id={`lxp-${c.id}`}
                type="number"
                min={0}
                max={c.maxLearningXP}
                step={1}
                value={c.learnedXP || 0}
                onChange={(e) => {
                  const v = Math.max(
                    0,
                    Math.min(c.maxLearningXP, parseInt(e.target.value, 10) || 0)
                  );
                  setField(c.masterId, c.fieldKey, 'learnedXP', v);
                }}
              />
              <input
                type="range"
                min={0}
                max={c.maxLearningXP}
                step={Math.max(1, Math.floor(c.maxLearningXP / 200))}
                value={c.learnedXP || 0}
                onChange={(e) =>
                  setField(
                    c.masterId,
                    c.fieldKey,
                    'learnedXP',
                    parseInt(e.target.value, 10) || 0
                  )
                }
                style={{
                  ['--xp-pct']: `${
                    c.maxLearningXP
                      ? Math.round(((c.learnedXP || 0) / c.maxLearningXP) * 100)
                      : 0
                  }%`,
                }}
                aria-label="Skill Learning XP progress"
              />
              <span className="learning-xp-pct">
                {c.maxLearningXP
                  ? `${Math.round(((c.learnedXP || 0) / c.maxLearningXP) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        ) : null}

        {!atMax && (
          <div className="checkbox-group">
            <label
              className={`checkbox-label${!c.canAfford || !c.to ? ' is-disabled' : ''}`}
              style={{ opacity: (c.canAfford && c.prereqsMet) || !c.to ? 1 : 0.5 }}
              title={!c.prereqsMet ? 'Prerequisites not met' : undefined}
            >
              <input
                className="checkbox"
                type="checkbox"
                checked={!!c.active && c.canAfford && c.prereqsMet}
                disabled={
                  !c.to ||
                  !c.prereqsMet ||
                  String(c.from) === String(c.to) ||
                  (!c.canAfford && !c.active)
                }
                onChange={(e) => setField(c.masterId, c.fieldKey, 'active', e.target.checked)}
              />{' '}
              Upgrade
            </label>
            {c.kind === 'skill' && c.remainingSeconds > 0 ? (
              <label
                className="checkbox-label"
                title="Spend Master Speedup first, then General Speedup from Vault, for remaining Learning XP training time"
              >
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={!!c.speedupOn}
                  onChange={(e) => setField(c.masterId, c.fieldKey, 'speedup', e.target.checked)}
                />{' '}
                +Speedups
              </label>
            ) : null}
            {c.kind === 'affinity' && c.emblemsNeed > 0 ? (
              <label
                className="checkbox-label"
                title="If this master's emblems are short, spend General Emblem from Vault"
              >
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={!!c.useGeneralEmblem}
                  onChange={(e) =>
                    setField(c.masterId, c.fieldKey, 'useGeneralEmblem', e.target.checked)
                  }
                />{' '}
                Use General Emblem
              </label>
            ) : null}
          </div>
        )}

        <CostStatus
          active={!!c.active && c.canAfford && c.prereqsMet}
          hasSelection={!!c.to && String(c.from) !== String(c.to)}
          atMax={atMax}
          points={c.points}
          costs={c.costs}
          vault={c.vaultBefore || vault}
          emptyHint={
            !c.prereqsMet
              ? 'Prerequisites not met'
              : c.kind === 'talent'
                ? 'No resource cost for talent'
                : 'Select current → target'
          }
        />
      </div>
    </div>
  );
}

export default function MastersPage() {
  const { data, loading, error } = useGameData('masters');
  const {
    state,
    updateSection,
    updateVaultField,
    setPageLockedCosts,
    remainingVaultExcluding,
  } = useApp();
  const { scoreRules: SCORE_RULES } = useScoreRules();
  const baseVault = useMemo(
    () => remainingVaultExcluding('masters'),
    [state.vault, state.lockedUpgrades, remainingVaultExcluding]
  );
  const mastersState = state.masters || {};
  const emblems = mastersState.__emblems || {};

  const mastersList = useMemo(() => extractMastersList(data), [data]);

  /** Vault + per-master emblem counts for affordability */
  const vault = useMemo(() => {
    const v = { ...baseVault };
    for (const m of mastersList) {
      const id = String(m.id || m.name || '').toLowerCase();
      v[emblemVaultKey(id)] = parseCost(emblems[id]);
    }
    return v;
  }, [baseVault, emblems, mastersList]);

  const setField = (masterId, key, field, value) => {
    updateSection('masters', (prev) => {
      const mid = { ...(prev[masterId] || {}) };
      const block = { ...(mid[key] || {}), [field]: value };
      if (field === 'from' || field === 'to') {
        block.active = false;
      }
      mid[key] = block;
      return { ...prev, [masterId]: mid };
    });
  };

  const setMasterMeta = (masterId, field, value) => {
    updateSection('masters', (prev) => ({
      ...prev,
      [masterId]: { ...(prev[masterId] || {}), [field]: value },
    }));
  };

  const setEmblem = (masterId, value) => {
    updateSection('masters', (prev) => ({
      ...prev,
      __emblems: { ...(prev.__emblems || {}), [masterId]: value },
    }));
  };

  /**
   * Talent auto-follows Affinity: current talent = f(current affinity).
   * Target talent follows affinity target when set.
   */
  useEffect(() => {
    if (!mastersList.length) return;
    let changed = false;
    const next = { ...mastersState };
    for (const master of mastersList) {
      const id = String(master.id || master.name || '').toLowerCase();
      const ms = next[id] || {};
      const aff = ms.affinity || {};
      const talent = { ...(ms.talent || {}) };
      const wantFrom = talentLevelFromAffinity(affinityNumericValue(master, aff.from ?? '0'));
      const wantTo = aff.to
        ? talentLevelFromAffinity(affinityNumericValue(master, aff.to))
        : '';
      if (String(talent.from ?? '') !== wantFrom) {
        talent.from = wantFrom;
        talent.active = false;
        changed = true;
      }
      if (String(talent.to ?? '') !== String(wantTo)) {
        talent.to = wantTo;
        talent.active = false;
        changed = true;
      }
      // Keep talent active in sync with affinity only when levels differ
      if (wantTo && wantFrom !== wantTo) {
        if (!!talent.active !== !!aff.active) {
          talent.active = !!aff.active;
          changed = true;
        }
      } else if (talent.active) {
        talent.active = false;
        changed = true;
      }
      if (changed) next[id] = { ...ms, talent };
    }
    if (changed) {
      updateSection('masters', () => {
        // merge only talent fields we fixed, preserve concurrent edits
        const out = { ...mastersState };
        for (const master of mastersList) {
          const id = String(master.id || master.name || '').toLowerCase();
          const aff = (mastersState[id] || {}).affinity || {};
          const wantFrom = talentLevelFromAffinity(affinityNumericValue(master, aff.from ?? '0'));
          const wantTo = aff.to
            ? talentLevelFromAffinity(affinityNumericValue(master, aff.to))
            : '';
          const prevT = (mastersState[id] || {}).talent || {};
          out[id] = {
            ...(mastersState[id] || {}),
            talent: {
              ...prevT,
              from: wantFrom,
              to: wantTo,
              active: wantTo && wantFrom !== wantTo ? !!aff.active : false,
            },
          };
        }
        return out;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mastersList.map((m) => {
      const id = String(m.id || m.name || '').toLowerCase();
      const a = mastersState[id]?.affinity || {};
      return `${id}:${a.from}:${a.to}:${!!a.active}`;
    }).join('|'),
  ]);

  /** Current affinity only (selected "from") — status steps use their milestone number */
  const effectiveAffinity = (masterId) => {
    const s = mastersState[masterId] || {};
    const aff = s.affinity || {};
    const master = mastersList.find(
      (m) => String(m.id || m.name || '').toLowerCase() === masterId
    );
    return affinityNumericValue(master, aff.from);
  };

  const prereqEnabled =
    (state.settings?.mastersBuffs || state.settings || {}).prereqCheck !== false;

  const setPrereqEnabled = (checked) => {
    updateSection('settings', (prev) => ({
      ...(prev || {}),
      mastersBuffs: { ...((prev || {}).mastersBuffs || {}), prereqCheck: checked },
    }));
  };

  const cards = useMemo(() => {
    const raw = [];
    try {
      for (const master of mastersList) {
        const id = String(master.id || master.name || '').toLowerCase() || 'unknown';
        const ms = mastersState[id] || {};
        const masterName = master.name || id;
        const masterType = master.type || '';
        const eKey = emblemVaultKey(id);

        // Affinity only (no special research)
        {
          const levels = affinityLevels(master);
          const from = ms.affinity?.from ?? '0';
          const to = ms.affinity?.to || '';
          const { points: pts, emblems: emblemsNeed } = to
            ? affinityRangeCost(master, from, to)
            : { points: 0, emblems: 0 };
          const useGenEmblem = !!ms.affinity?.useGeneralEmblem;
          const costs = to ? { ...affinityPointsToItems(pts) } : {};
          if (emblemsNeed > 0) {
            Object.assign(costs, splitEmblemCost(id, emblemsNeed, emblems, useGenEmblem));
          }
          const basePoints = emblemsNeed * (SCORE_RULES.general_emblem || 0);
          raw.push({
            id: `${id}__affinity`,
            masterId: id,
            masterName,
            masterType,
            kind: 'affinity',
            fieldKey: 'affinity',
            title: 'Affinity',
            levels,
            from,
            to,
            costs,
            affinityPtsNeeded: pts,
            emblemsNeed,
            useGeneralEmblem: useGenEmblem,
            basePoints,
            learningSeconds: 0,
            speedupMins: 0,
            speedupKey: null,
            speedupOn: false,
            active: !!ms.affinity?.active,
            prereqItems: [],
            prereqsMet: true,
          });
        }

        {
          const levels = talentLevels(master);
          const from = ms.talent?.from ?? '0';
          const to = ms.talent?.to || '';
          const needAff = to ? talentAffinityReq(to) : 0;
          const haveAff = effectiveAffinity(id);
          const prereqItems = [];
          if (needAff > 0) {
            prereqItems.push({
              raw: `Affinity ${needAff} (talent rank)`,
              name: 'Affinity',
              level: needAff,
              have: haveAff,
              met: haveAff >= needAff,
              tracked: true,
            });
          }
          const prereqsMet = prereqEnabled ? prereqItems.every((p) => p.met) : true;
          raw.push({
            id: `${id}__talent`,
            masterId: id,
            masterName,
            masterType,
            kind: 'talent',
            fieldKey: 'talent',
            title: master.talent?.name || 'Talent',
            levels,
            from,
            to,
            costs: {},
            basePoints: 0,
            learningSeconds: 0,
            speedupMins: 0,
            speedupKey: null,
            speedupOn: false,
            active: !!ms.talent?.active,
            prereqItems,
            prereqsMet,
                      });
        }

        (master.skills || []).forEach((skill, idx) => {
          const key = `skill${skill.id || idx + 1}`;
          const ss = ms[key] || {};
          const levels = skillLevels(skill);
          const from = ss.from ?? '0';
          const to = ss.to || '';
          const { manuscripts, learningSeconds: rangeLearning } = to
            ? skillUpgradeCosts(skill, from, to)
            : { manuscripts: 0, learningSeconds: 0 };
          const maxLearningXP = skillMaxLearningXP(skill);
          const costs = {};
          if (manuscripts > 0) costs.master_manuscript = manuscripts;
          const speedupOn = !!ss.speedup;
          // Skill-wide learned XP (0 … max for this skill), not capped to selected range
          const learnedXP = Math.max(
            0,
            Math.min(maxLearningXP, parseCost(ss.learnedXP))
          );
          const remainingSeconds = to
            ? skillRemainingLearningXP(skill, from, to, learnedXP)
            : 0;
          const speedupMins =
            speedupOn && remainingSeconds > 0 ? Math.ceil(remainingSeconds / 60) : 0;
          const basePoints = manuscripts * (SCORE_RULES.master_manuscript || 0);

          const needAff = to ? skillLevelAffinityReq(skill, to) : 0;
          const haveAff = effectiveAffinity(id); // numeric, for display
          const curAffVal = (ms.affinity || {}).from ?? '0';
          const prereqItems = [];
          if (needAff > 0) {
            const met = meetsAffinityStatusReq(master, curAffVal, needAff);
            const label = affinityReqLabel(master, needAff);
            prereqItems.push({
              raw: `Need ${label}`,
              name: 'Affinity',
              level: label,
              have: curAffVal || '0',
              met,
              tracked: true,
              detail: met ? undefined : `current affinity: ${curAffVal || '0'}`,
            });
          }

          // Unlock is the status step after the milestone (Affinity 40 → Casual 1)
          const unlockAff = parseAffinityReqNumber(skill.unlock);
          const unlockLabel =
            unlockAff > 0 ? affinityReqLabel(master, unlockAff) : skill.unlock || '';
          const unlockUnmet =
            unlockAff > 0 && !meetsAffinityStatusReq(master, curAffVal, unlockAff);

          raw.push({
            id: `${id}__${key}`,
            masterId: id,
            masterName,
            masterType,
            kind: 'skill',
            fieldKey: key,
            title: skill.name || `Skill ${idx + 1}`,
            skillType: skill.type,
            unlock: skill.unlock,
            unlockLabel,
            unlockUnmet,
            levels,
            from,
            to,
            costs,
            basePoints,
            learningSeconds: rangeLearning,
            maxLearningXP,
            learnedXP,
            remainingSeconds,
            speedupMins,
            speedupKey: speedupOn ? 'master_speedup' : null,
            speedupOn,
            active: !!ss.active,
            prereqItems,
            prereqsMet: prereqEnabled ? prereqItems.every((p) => p.met) : true,
          });
        });
      }
    } catch (e) {
      console.error('[MastersPage] card build failed', e);
      return [];
    }

    const afford = sequentialAfford(
      raw.map((c) => ({
        id: c.id,
        costs: c.costs,
        active: c.active && c.prereqsMet,
        speedupMins: c.speedupMins,
        speedupKey: c.speedupKey,
      })),
      vault
    );

    return raw.map((c) => {
      const a = afford.get(c.id) || { canAfford: true, vaultBefore: vault };
      const canAfford = !!(a.canAfford && c.prereqsMet);
      const resolvedCosts = a.resolvedCosts || c.costs;
      const usedSpd = a.speedupAlloc?.used ?? 0;
      const points =
        (c.basePoints || 0) + (usedSpd > 0 ? usedSpd * (SCORE_RULES.speedup_min ?? 0) : 0);
      return {
        ...c,
        costs: resolvedCosts,
        points,
        canAfford,
        vaultBefore: a.vaultBefore,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mastersList, mastersState, vault, SCORE_RULES, prereqEnabled]);


  const totalActivePoints = useMemo(
    () => cards.reduce((s, c) => s + (c.active && c.canAfford ? c.points : 0), 0),
    [cards]
  );

  useEffect(() => {
    // Lock only real vault resources (affinity items, manuscripts, speedups).
    // Per-master emblems live in masters.__emblems — map them to general_emblem for display score only.
    const locked = sumActiveCosts(
      cards.map((c) => {
        const costs = { ...(c.costs || {}) };
        // Strip synthetic emblem keys from vault lock; emblems are page-local inventory
        for (const k of Object.keys(costs)) {
          if (k.startsWith('master_emblem_')) delete costs[k];
        }
        return { id: c.id, costs, active: c.active && c.canAfford };
      }),
      new Map(cards.map((c) => [c.id, { canAfford: c.canAfford }]))
    );
    setPageLockedCosts('masters', locked);
  }, [cards, setPageLockedCosts]);

  usePublishPageScore('masters', totalActivePoints);

  const sections = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const c of cards) {
      if (!map.has(c.masterId)) {
        map.set(c.masterId, {
          id: c.masterId,
          name: c.masterName,
          type: c.masterType,
          cards: [],
        });
        order.push(c.masterId);
      }
      map.get(c.masterId).cards.push(c);
    }
    return order.map((id) => map.get(id));
  }, [cards]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
      </div>
    );
  }
  if (!mastersList.length) {
    return (
      <div className="page-error">
        <p>No masters data loaded.</p>
        <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Payload keys:{' '}
          {data && typeof data === 'object'
            ? Object.keys(data).join(', ') || '(empty)'
            : String(data)}
        </p>
      </div>
    );
  }

  return (
    <div className="app-container masters-page">
      <div
        className="buff-panel"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          marginBottom: 12,
          padding: '10px 14px',
        }}
      >
        <label
          className="checkbox-label"
          title="When on, Upgrade is blocked until Affinity prerequisites are met"
        >
          <input
            className="checkbox"
            type="checkbox"
            checked={prereqEnabled}
            onChange={(e) => setPrereqEnabled(e.target.checked)}
          />{' '}
          Enforce prerequisite checks
        </label>
      </div>

      <MastersInventory
        mastersList={mastersList}
        vault={state.vault || {}}
        updateVaultField={updateVaultField}
        emblems={emblems}
        setEmblem={setEmblem}
      />

      {sections.map((group) => {
        return (
          <div className="item-card" key={group.id} style={{ marginBottom: 16 }}>
            <div className="item-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <AssetImg
                src={masterImg(group.id)}
                fallbacks={masterImgFallbacks(group.id)}
                size={40}
                alt={group.name}
              />
              <span>
                {group.name}
                {group.type ? (
                  <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 8 }}>
                    {group.type}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="item-card-body">
              <div className="items-grid cards-grid">
                {group.cards.map((c) => (
                  <UpgradeRow
                    key={c.id}
                    c={c}
                    setField={setField}
                    vault={vault}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
