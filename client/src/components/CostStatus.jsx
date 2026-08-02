import { formatNumber, formatSecondsToTime, parseResourceValue } from '../utils/calc';
import { computeAffordability } from '../utils/resources';
import AssetImg from './AssetImg';
import { resourceImg } from '../utils/images';

export default function CostStatus({
  active,
  hasSelection,
  points,
  stepsInfo = '',
  costs = {},
  vault = {},
  extra = null,
}) {
  if (!hasSelection) {
    return <div className="status-pane">Select current & target level</div>;
  }

  const { remaining, canAfford } = computeAffordability(costs, vault);

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

  const hasCosts = Object.keys(costs || {}).filter(k => !k.startsWith('_')).length > 0;

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
      {hasCosts && (
        <div className="cost-grid">
          {Object.entries(costs || {}).map(([key, amt]) => {
            if (key.startsWith('_')) return null;
            const have = parseResourceValue(vault?.[key]);
            const need = parseFloat(amt) || 0;
            const left = have - need;
            const deficit = left < 0;
            const isSpeedup = key.includes('speedup');
            const displayNeed = isSpeedup ? formatSecondsToTime(need * 60) : formatNumber(need);
            const displayLeft = isSpeedup ? formatSecondsToTime(Math.abs(left) * 60) : formatNumber(Math.abs(left));
            const displayRemaining = isSpeedup ? formatSecondsToTime(left * 60) : formatNumber(left);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <AssetImg src={resourceImg(key)} size={18} />
                <span>
                  {key.replace(/_/g, ' ')}: {displayNeed}
                </span>
                <span className={deficit ? 'text-deficit' : 'text-remaining'}>
                  ({left >= 0 ? displayRemaining + ' left' : displayLeft + ' short'})
                </span>
              </div>
            );
          })}
        </div>
      )}
      {!active && canAfford && (
        <span className="text-remaining">Check Upgrade to lock points</span>
      )}
      {!canAfford && (
        <span className="text-deficit">Add resources in Vault or lower target</span>
      )}
    </div>
  );
}