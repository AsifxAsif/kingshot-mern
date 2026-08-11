import { formatNumber } from '../utils/calc';
import { formatCostLines, computeAffordability } from '../utils/resources';
import ResourceLines from './ResourceLines';

/**
 * Status pane matching original: ESTIMATED / ACTIVE / INSUFFICIENT
 * with shared ResourceLines styling on every page.
 */
export default function CostStatus({
  active,
  hasSelection,
  points,
  stepsInfo = '',
  costs = {},
  vault = {},
  extra = null,
  /** optional prebuilt lines (overrides costs/vault formatting) */
  lines: linesProp = null,
  emptyHint = 'Select current & target level',
}) {
  if (!hasSelection) {
    return <div className="status-pane">{emptyHint}</div>;
  }

  const { canAfford } = linesProp
    ? {
        canAfford: !linesProp.some((l) => l.deficit),
      }
    : computeAffordability(costs, vault);

  const lines = linesProp || formatCostLines(costs, vault);

  if ((!lines || lines.length === 0) && (points == null || points === 0)) {
    return (
      <div className="status-pane status-info">
        Levels selected — no cost rows found for this range (try different levels)
      </div>
    );
  }

  let label;
  let cls = 'status-pane';
  if (active && canAfford) {
    label = `ACTIVE${stepsInfo}`;
    cls += ' status-ok';
  } else if (!canAfford) {
    label = `INSUFFICIENT RESOURCES${stepsInfo}`;
    cls += ' status-error';
  } else {
    label = `ESTIMATED${stepsInfo}`;
    cls += ' status-info';
  }

  return (
    <div className={cls}>
      <div>
        <strong>{label}</strong>
        {points != null && canAfford && <> +{formatNumber(points)} pts</>}
        {points != null && !canAfford && points > 0 && (
          <> (would be +{formatNumber(points)} pts)</>
        )}
      </div>
      {extra}
      <ResourceLines lines={lines} />
      {!active && canAfford && (
        <span className="text-remaining">Check Upgrade to lock points</span>
      )}
      {!canAfford && (
        <span className="text-deficit">Add resources in Vault / inventory or lower target</span>
      )}
    </div>
  );
}
