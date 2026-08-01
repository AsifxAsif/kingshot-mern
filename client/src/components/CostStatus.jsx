import { formatNumber } from '../utils/calc';
import { formatCostLines, computeAffordability } from '../utils/resources';
import AssetImg from './AssetImg';
import { resourceImg } from '../utils/images';

/**
 * Status pane matching original: ESTIMATED / ACTIVE / INSUFFICIENT
 * with remaining resource amounts
 */
export default function CostStatus({
  active,
  hasSelection,
  points,
  stepsInfo = '',
  costs = {},
  vault = {},
  extra = null, // time / speedup lines
}) {
  if (!hasSelection) {
    return <div className="status-pane">Select current & target level</div>;
  }

  const { canAfford } = computeAffordability(costs, vault);
  const lines = formatCostLines(costs, vault);

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
      <div className="cost-grid">
        {lines.map(({ key, need, left, deficit }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <AssetImg src={resourceImg(key)} size={18} />
            <span>
              {key.replace(/_/g, ' ')}: {formatNumber(need)}
            </span>
            <span className={deficit ? 'text-deficit' : 'text-remaining'}>
              ({left >= 0 ? formatNumber(left) + ' left' : formatNumber(Math.abs(left)) + ' short'})
            </span>
          </div>
        ))}
      </div>
      {!active && canAfford && (
        <span className="text-remaining">Check Upgrade to lock points</span>
      )}
      {!canAfford && (
        <span className="text-deficit">Add resources in Vault or lower target</span>
      )}
    </div>
  );
}
