import { formatNumber } from '../utils/calc';
import { formatCostLines, computeAffordability, vaultAmount, normalizeCostMap } from '../utils/resources';
import ResourceLines from './ResourceLines';

/**
 * Resource status for one upgrade card.
 *
 * @param {object} costs — this card's costs
 * @param {object} vault — sequential vault *before* this card (after prior active+affordable)
 * @param {object} [sharedVault] — vault after all active+affordable on the page (display remaining)
 * @param {boolean} [canAffordProp] — optional override from sequentialAfford (preferred)
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
  const poolAfter = sharedVault || poolBefore;
  const normCosts = normalizeCostMap(costs);

  let lines = linesProp;
  if (!lines) {
    lines = formatCostLines(normCosts, poolBefore).map((row) => {
      const need = Number(row.need) || 0;
      const have = vaultAmount(poolBefore, row.key);
      const deficit = need > 0 && have < need;
      const after = vaultAmount(poolAfter, row.key);
      return {
        ...row,
        need,
        have,
        // Short → negative left for ResourceLines; OK → shared leftover after actives
        left: deficit ? have - need : after,
        deficit,
      };
    });
  }

  // Single source of truth: any line short ⇒ cannot afford
  const linesShort = lines.some((l) => l.deficit || (Number(l.need) > 0 && Number(l.have) < Number(l.need)));
  const computed = computeAffordability(normCosts, poolBefore);
  const canAfford =
    canAffordProp != null
      ? !!canAffordProp && !linesShort
      : computed.canAfford && !linesShort;

  if ((!lines || lines.length === 0) && (points == null || points === 0) && !lockReasons?.length) {
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

  const showPts = points != null && Number(points) > 0;

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
