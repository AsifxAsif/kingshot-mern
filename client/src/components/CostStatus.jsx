import { formatNumber } from '../utils/calc';
import { formatCostLines, computeAffordability, vaultAmount } from '../utils/resources';
import ResourceLines from './ResourceLines';

export default function CostStatus({
  active,
  hasSelection,
  points,
  stepsInfo = '',
  costs = {},
  vault = {},
  extra = null,
  lines: linesProp = null,
  emptyHint = 'Select current & target level',
  atMax = false,
}) {
  // Already at max — LevelSelects already shows "Maxed — no further upgrades"
  if (atMax) {
    return null;
  }

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

  if ((!lines || lines.length === 0) && (points == null || points === 0)) {
    return (
      <div className="status-pane status-info">
        Levels selected — no cost rows found for this range
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
      <ResourceLines lines={lines} active={!!active && canAfford} />
      {!active && canAfford && (
        <span className="text-remaining">Check Upgrade to lock points</span>
      )}
      {!canAfford && (
        <span className="text-deficit">Add resources in Vault or lower target</span>
      )}
    </div>
  );
}
