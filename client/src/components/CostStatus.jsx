import { formatNumber } from '../utils/calc';
import { formatCostLines, computeAffordability, vaultAmount } from '../utils/resources';
import ResourceLines from './ResourceLines';

/**
 * @param {boolean} [hasSelection] — false → only emptyHint (no costs / upgrade prompt)
 * @param {boolean} [atMax]
 * @param {string[]} [lockReasons]
 */
export default function CostStatus({
  active,
  hasSelection = true,
  points,
  stepsInfo = '',
  costs = {},
  vault = {},
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

  const { canAfford } = linesProp
    ? { canAfford: !linesProp.some((l) => l.deficit) }
    : computeAffordability(costs, vault);

  let lines = linesProp;
  if (!lines) {
    lines = formatCostLines(costs, vault).map((row) => ({
      ...row,
      have: vaultAmount(vault, row.key),
      left: vaultAmount(vault, row.key) - (Number(row.need) || 0),
    }));
  }

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
    reasons.push('Not enough items in Vault for this upgrade — add stock or lower the target.');
  }
  for (const r of extraReasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  return (
    <div className={cls}>
      <div>
        <strong>{label}</strong>
        {points != null && canAfford && !blocked && <> +{formatNumber(points)} pts</>}
        {points != null && blocked && points > 0 && (
          <> (would be +{formatNumber(points)} pts)</>
        )}
      </div>
      {extra}
      <ResourceLines lines={lines} active={!!active && canAfford && !locked} />
      {!active && canAfford && !blocked && (
        <span className="text-remaining">Check Upgrade to lock these points</span>
      )}
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
