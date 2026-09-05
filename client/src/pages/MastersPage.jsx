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

/** Show blank with placeholder "0" instead of a raw 0 value */
function emptyZeroInput(v) {
  if (v == null || v === '' || v === 0 || v === '0') return '';
  return String(v);
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
  { id: 'elite_spices', label: 'Elite Spices', points: 1000, placeholder: '0' },
  { id: 'silver_goblet', label: 'Silver Goblet', points: 100, placeholder: '0' },
  { id: 'copper_horn', label: 'Copper Horn', points: 10, placeholder: '0' },
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
 *
 * Cost model (matches game data):
 *   - affinityCost on level N is the cost to advance FROM N (or its status) TO N+1
 *   - Status steps (Close 3, etc.) cost emblems to *enter*; the row’s affinityCost
 *     is paid when *leaving* that status toward the next numeric level
 *   Example: Close 3 → 91 uses level 90’s affinityCost (3500), NOT level 91’s (3550)
 */
function affinitySteps(master) {
  const rows = [...(master?.affinity || [])].sort(
    (a, b) => (Number(a.level) || 0) - (Number(b.level) || 0)
  );
  const steps = [];
  for (const row of rows) {
    const lv = Number(row.level) || 0;
    const ac = parseCost(row.affinityCost);
    const emblems = parseEmblemFromAdvancement(row.advancement);
    const status = advancementStatusName(row.advancement);

    // Being at numeric level N — no enter cost (paid when leaving previous)
    steps.push({
      key: `lv_${lv}`,
      kind: 'level',
      level: lv,
      label: String(lv),
      affinityCost: 0,
      emblems: 0,
      exitAffinity: 0,
      exitEmblems: 0,
    });

    if (row.advancement && status) {
      // Enter status: emblems only. Leave status → next level: this row’s affinityCost
      steps.push({
        key: `adv_${lv}`,
        kind: 'advancement',
        level: lv,
        label: status,
        affinityCost: 0,
        emblems,
        exitAffinity: ac,
        exitEmblems: 0,
      });
    } else {
      // No status step — leave this numeric level toward next by paying affinityCost
      steps[steps.length - 1].exitAffinity = ac;
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
        exitAffinity: 0,
        exitEmblems: 0,
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
  const n = levelNum(v);
  idx = steps.findIndex((s) => s.kind === 'level' && s.level === n);
  return idx;
}

/** Sum costs for moving from fromVal → toVal (leave current, enter each next step) */
function affinityRangeCost(master, fromVal, toVal) {
  const steps = affinitySteps(master);
  const fromIdx = stepIndex(steps, fromVal);
  const toIdx = stepIndex(steps, toVal);
  if (fromIdx < 0 || toIdx < 0 || toIdx <= fromIdx) {
    return { points: 0, emblems: 0 };
  }
  let points = 0;
  let emblems = 0;
  for (let i = fromIdx; i < toIdx; i++) {
    // Leaving step i
    points += steps[i].exitAffinity || 0;
    emblems += steps[i].exitEmblems || 0;
    // Entering step i+1
    points += steps[i + 1].affinityCost || 0;
    emblems += steps[i + 1].emblems || 0;
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

/** Highest skill level number in data */
function skillMaxLevel(skill) {
  let max = 0;
  for (const row of skill?.levels || []) {
    max = Math.max(max, levelNum(row.level));
  }
  return max;
}

/**
 * Learning XP (seconds) strictly for levels (fromLv, toLv] — never counts levels
 * already at or below the selected current level.
 */
function skillPathLearningXP(skill, fromLv, toLv) {
  const from = levelNum(fromLv);
  const to = levelNum(toLv);
  if (to <= from) return 0;
  let total = 0;
  for (const row of skill?.levels || []) {
    const lv = Number(row.level) || 0;
    if (lv > from && lv <= to) total += parseCost(row.learningXP);
  }
  return total;
}

/**
 * Remaining XP for from→to. `learnedXP` is partial progress *from the selected
 * current level* toward max (not from level 0).
 */
function skillRemainingLearningXP(skill, fromLv, toLv, learnedXP) {
  const pathToTarget = skillPathLearningXP(skill, fromLv, toLv);
  const learned = Math.max(0, parseCost(learnedXP));
  return Math.max(0, pathToTarget - learned);
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


/** Inventory strip at top of Masters page — emblems only (affinity gifts live on Vault) */
function MastersInventory({ mastersList, emblems, setEmblem }) {
  return (
    <div className="item-card" style={{ marginBottom: 16, gridColumn: '1 / -1' }}>
      <div className="item-card-header">
        <span>Master emblems</span>
      </div>
      <div className="item-card-body">
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
                  value={emptyZeroInput(emblems[id])}
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

  const skillLocked = c.kind === 'skill' && c.unlockUnmet;

  return (
    <div
      className="item-card group-card-item"
      style={{
        margin: 0,
        boxShadow: 'none',
        opacity: skillLocked ? 0.72 : 1,
        pointerEvents: skillLocked ? 'none' : undefined,
      }}
    >
      <div className="item-card-header" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <AssetImg
          src={
            c.kind === 'affinity'
              ? masterAffinityImg(c.masterId)
              : c.kind === 'skill'
                ? masterSkillImg(c.masterId, c.title)
                : masterImg(c.masterId)
          }
          fallbacks={
            c.kind === 'affinity'
              ? masterAffinityImgFallbacks(c.masterId)
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
        {c.kind === 'affinity' ? (
          <span
            className="affinity-talent-header"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginLeft: 'auto',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            <AssetImg
              src={masterTalentImg(c.masterId)}
              fallbacks={masterTalentImgFallbacks(c.masterId)}
              size={36}
              alt={c.talentName || 'Talent'}
            />
            <span>
              {c.talentName || 'Talent'}
              {' · '}
              rank <strong>{c.talentFrom ?? '—'}</strong>
              {c.talentTo && String(c.talentTo) !== String(c.talentFrom) ? (
                <>
                  {' '}
                  → <strong>{c.talentTo}</strong>
                </>
              ) : null}
            </span>
          </span>
        ) : null}
      </div>
      <div
        className="item-card-body"
        style={
          c.kind === 'skill' && c.unlockUnmet
            ? { opacity: 0.85 }
            : undefined
        }
      >
        {c.kind === 'skill' && c.unlockUnmet ? (
          <div
            className="status-pane"
            style={{
              margin: 0,
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'var(--surface-dark, var(--surface))',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--color-warning, #ffb74d)', marginBottom: 4 }}>
              Locked
            </div>
            Unlocks at affinity:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {c.unlockLabel || c.unlock || '—'}
            </strong>
          </div>
        ) : (
        <>
        {c.kind === 'affinity' ? (
          <div className="learning-xp-block" style={{ marginBottom: 10 }}>
            {c.to ? (
              <div className="learning-xp-summary">
                Affinity needed for this upgrade:{' '}
                <strong>{formatNumber(c.affinityPtsRaw || 0)}</strong>
                {c.bankedAffinity > 0 ? (
                  <>
                    {' '}
                    − already have <strong>{formatNumber(c.bankedAffinity)}</strong>
                    {' = '}
                    <strong>{formatNumber(c.affinityPtsNeeded)}</strong> left to get
                  </>
                ) : null}
              </div>
            ) : null}
            <label className="learning-xp-label" htmlFor={`banked-${c.id}`}>
              Extra affinity points you already have
            </label>
            <div className="learning-xp-controls">
              <input
                id={`banked-${c.id}`}
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={emptyZeroInput(c.bankedAffinity)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setField(
                    c.masterId,
                    c.fieldKey,
                    'bankedAffinity',
                    raw === '' ? '' : Math.max(0, parseInt(raw, 10) || 0)
                  );
                }}
              />
            </div>
          </div>
        ) : null}

        {(
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

        {c.kind === 'skill' && !c.atSkillMax && c.pathToMax > 0 ? (
          <div className="learning-xp-block">
            <label className="learning-xp-label" htmlFor={`lxp-${c.id}`}>
              Training already done (toward max from current level)
            </label>
            <div className="learning-xp-controls">
              <input
                id={`lxp-${c.id}`}
                type="number"
                min={0}
                max={c.pathToMax}
                step={1}
                placeholder="0"
                value={emptyZeroInput(c.learnedXP)}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setField(c.masterId, c.fieldKey, 'learnedXP', '');
                    return;
                  }
                  const v = Math.max(
                    0,
                    Math.min(c.pathToMax, parseInt(raw, 10) || 0)
                  );
                  setField(c.masterId, c.fieldKey, 'learnedXP', v);
                }}
              />
              <input
                type="range"
                min={0}
                max={c.pathToMax}
                step={Math.max(1, Math.floor(c.pathToMax / 200))}
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
                    c.pathToMax
                      ? Math.round(((c.learnedXP || 0) / c.pathToMax) * 100)
                      : 0
                  }%`,
                }}
                aria-label="Training progress"
              />
              <span className="learning-xp-pct">
                {c.pathToMax
                  ? `${Math.round(((c.learnedXP || 0) / c.pathToMax) * 100)}%`
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
          extra={
            c.kind === 'skill' && c.to && c.learningSeconds > 0 ? (
              <div
                className="skill-training-cost"
                style={{
                  marginTop: 6,
                  marginBottom: 4,
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                }}
              >
                <div>
                  Training time for this upgrade:{' '}
                  <strong>{formatSecondsToTime(c.learningSeconds)}</strong>
                </div>
                <div>
                  Already trained:{' '}
                  <strong>
                    {formatSecondsToTime(
                      Math.min(c.learnedXP || 0, c.learningSeconds)
                    )}
                  </strong>
                  {' / '}
                  {formatSecondsToTime(c.learningSeconds)}
                </div>
                <div>
                  Time left to train:{' '}
                  <strong>
                    {c.remainingSeconds > 0
                      ? formatSecondsToTime(c.remainingSeconds)
                      : 'Done'}
                  </strong>
                  {c.speedupOn && c.remainingSeconds > 0
                    ? ` → ${formatNumber(c.speedupMins)} min speedup`
                    : null}
                </div>
              </div>
            ) : null
          }
        />
        </>
        )}
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
        // Path XP is relative to current skill level — reset partial progress on level change
        if (field === 'from' && String(key).startsWith('skill')) {
          block.learnedXP = 0;
        }
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

  /** Hide only maxed *skill* cards — affinity always stays visible */
  const hideMaxedSkills =
    !!(state.settings?.mastersBuffs || {}).hideMaxedSkills;

  const setHideMaxedSkills = (checked) => {
    updateSection('settings', (prev) => ({
      ...(prev || {}),
      mastersBuffs: {
        ...((prev || {}).mastersBuffs || {}),
        hideMaxedSkills: !!checked,
      },
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
          const { points: ptsRaw, emblems: emblemsNeed } = to
            ? affinityRangeCost(master, from, to)
            : { points: 0, emblems: 0 };
          const bankedAffinity = Math.max(0, parseCost(ms.affinity?.bankedAffinity));
          const pts = Math.max(0, ptsRaw - bankedAffinity);
          const useGenEmblem = !!ms.affinity?.useGeneralEmblem;
          const costs = to ? { ...affinityPointsToItems(pts) } : {};
          if (emblemsNeed > 0) {
            Object.assign(costs, splitEmblemCost(id, emblemsNeed, emblems, useGenEmblem));
          }
          const basePoints = emblemsNeed * (SCORE_RULES.general_emblem || 0);
          const talentFrom = talentLevelFromAffinity(affinityNumericValue(master, from));
          const talentTo = to
            ? talentLevelFromAffinity(affinityNumericValue(master, to))
            : talentFrom;
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
            affinityPtsRaw: ptsRaw,
            bankedAffinity,
            emblemsNeed,
            useGeneralEmblem: useGenEmblem,
            talentFrom,
            talentTo,
            talentName: master.talent?.name || 'Talent',
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
        (master.skills || []).forEach((skill, idx) => {
          const key = `skill${skill.id || idx + 1}`;
          const ss = ms[key] || {};
          const levels = skillLevels(skill);
          const from = ss.from ?? '0';
          const to = ss.to || '';
          const maxLv = skillMaxLevel(skill);
          const atSkillMax =
            maxLv > 0 && levelNum(from) >= maxLv && (!to || levelNum(to) <= levelNum(from));
          const { manuscripts, learningSeconds: rangeLearning } = to
            ? skillUpgradeCosts(skill, from, to)
            : { manuscripts: 0, learningSeconds: 0 };
          // Path XP from selected current level → skill max (partial progress basis)
          const pathToMax = skillPathLearningXP(skill, from, maxLv);
          const costs = {};
          if (manuscripts > 0) costs.master_manuscript = manuscripts;
          const speedupOn = !!ss.speedup;
          // learnedXP = progress from *current level* toward max (not from 0)
          const learnedXP = Math.max(
            0,
            Math.min(pathToMax, parseCost(ss.learnedXP))
          );
          const remainingSeconds =
            to && !atSkillMax
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
            maxLearningXP: pathToMax,
            pathToMax,
            atSkillMax,
            learnedXP,
            remainingSeconds,
            speedupMins,
            speedupKey: speedupOn ? 'master_speedup' : null,
            speedupOn,
            active: unlockUnmet ? false : !!ss.active,
            prereqItems,
            prereqsMet: unlockUnmet
              ? false
              : prereqEnabled
                ? prereqItems.every((p) => p.met)
                : true,
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

  const hasMaxedSkills = useMemo(
    () => cards.some((c) => c.kind === 'skill' && c.atSkillMax),
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
      // Only hide maxed skill cards — never hide affinity
      if (hideMaxedSkills && c.kind === 'skill' && c.atSkillMax) continue;
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
  }, [cards, hideMaxedSkills]);

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
        {hasMaxedSkills ? (
          <label
            className="checkbox-label"
            title="Hide skill cards that are already at max level (Affinity card always stays visible)"
          >
            <input
              className="checkbox"
              type="checkbox"
              checked={hideMaxedSkills}
              onChange={(e) => setHideMaxedSkills(e.target.checked)}
            />{' '}
            Hide maxed skills
          </label>
        ) : null}
      </div>

      <MastersInventory
        mastersList={mastersList}
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
