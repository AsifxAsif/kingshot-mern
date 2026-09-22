import { formatNumber } from '../utils/calc';
import { computeAffordability, formatCostLines, vaultAmount } from '../utils/resources';
import ResourceLines from './ResourceLines';

/**
 * @param {object} props
 * @param {string[]} [props.lockReasons] — extra human reasons (prereq, mastery, etc.)
 * @param {boolean} [props.locked] — force locked messaging even if affordable
 */
export default function CostStatus({
  costs,
  vault,
  points,
  active,
  steps,
  lines: linesProp,
  emptyHint = 'Select current and target levels',
  extra = null,
  lockReasons = null,
  locked = false,
}) {
  const stepsInfo =
    steps != null && Number(steps) > 0 ? ` (${Number(steps)} steps)` : '';

  if (!costs && !linesProp) {
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
