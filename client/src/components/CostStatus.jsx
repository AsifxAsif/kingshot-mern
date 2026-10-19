import { formatNumber } from '../utils/calc';
import { computeAffordability, vaultAmount, normalizeCostMap } from '../utils/resources';
import ResourceLines from './ResourceLines';

/**
 * vault = sequential amount available to THIS card (before its own lock)
 * sharedVault = leftover after every ACTIVE lock on the page
 * canAfford = sequentialAfford result for this card
 */
export default function CostStatus({
  active,
  hasSelection = true,
  points,
  stepsInfo = '',
  costs = {},
  vault = {},
  sharedVault = null,
  canAfford: canAffordProp = null,
  extra = null,
  lines: linesProp = null,
  emptyHint = 'Select current & target level',
  atMax = false,
  lockReasons = null,
  locked = false,
}) {
  if (atMax) return null;

  if (!hasSelection) {
    return <div className="status-pane">{emptyHint}</div>;
  }

  const poolBefore = vault || {};
  const poolAfter = sharedVault != null ? sharedVault : poolBefore;
  const normCosts = normalizeCostMap(costs || {});

  let lines = linesProp;
  if (!lines) {
    lines = Object.entries(normCosts).map(([key, needRaw]) => {
      const need = Number(needRaw) || 0;
      // What this card can still draw before its own spend
      const have = vaultAmount(poolBefore, key);
      const after = vaultAmount(poolAfter, key);
      const deficit = need > 0 && have < need;
      return {
        key,
        need,
        have,
        // Short: show have + short. OK: leftover after all active locks
        left: deficit ? have - need : after,
        deficit,
      };
    });
  }

  const anyShort = lines.some(
    (l) => Number(l.need) > 0 && Number(l.have) < Number(l.need)
  );
  const computedOk = computeAffordability(normCosts, poolBefore).canAfford;
  const canAfford =
    canAffordProp != null ? !!canAffordProp && !anyShort : computedOk && !anyShort;

  if ((!lines || lines.length === 0) && (points == null || points === 0) && !(lockReasons || []).length) {
    return (
      <div className="status-pane status-info">
        Levels selected — no cost rows found for this range
      </div>
    );
  }

  const extraReasons = (Array.isArray(lockReasons) ? lockReasons : [])
    .map((r) => String(r || '').trim())
    .filter(Boolean);

  const blocked = locked || !canAfford || extraReasons.length > 0;

  let label;
  let cls = 'status-pane';
  if (active && canAfford && !locked && extraReasons.length === 0) {
    label = `ACTIVE${stepsInfo}`;
    cls += ' status-ok';
  } else if (active && !canAfford) {
    label = `INSUFFICIENT RESOURCES${stepsInfo}`;
    cls += ' status-error';
  } else if (blocked) {
    label = !canAfford
      ? `INSUFFICIENT RESOURCES${stepsInfo}`
      : `UPGRADE LOCKED${stepsInfo}`;
    cls += ' status-error';
  } else {
    label = `ESTIMATED${stepsInfo}`;
    cls += ' status-info';
  }

  const reasons = [];
  if (!canAfford) {
    reasons.push('Not enough items in Vault for this upgrade.');
  }
  for (const r of extraReasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  const showPts = points != null && Number(points) > 0 && canAfford;

  return (
    <div className={cls}>
      <div>
        <strong>{label}</strong>
        {showPts && (
          <>
            {' '}
            <span className="status-pts">+{formatNumber(points)} pts</span>
          </>
        )}
      </div>
      {extra}
      <ResourceLines lines={lines} active={!!active && canAfford && !locked} />
      {reasons.length > 0 && (
        <ul className="lock-reason-list">
          {reasons.map((r, i) => (
            <li key={i} className="text-deficit lock-reason">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
