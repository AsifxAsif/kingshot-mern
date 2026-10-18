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
  sharedVault = null,
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

  // vault = sequential pool *before* this card (used for short / canAfford)
  // sharedVault = after all ACTIVE on the page (used for "X remaining" when affordable)
  const poolAfterActives = sharedVault || vault;

  const { canAfford } = linesProp
    ? { canAfford: !linesProp.some((l) => l.deficit) }
    : computeAffordability(costs, vault);

  let lines = linesProp;
  if (!lines) {
    lines = formatCostLines(costs, vault).map((row) => {
      const need = Number(row.need) || 0;
      // Affordability / short = can we pay THIS card from vault before it spends?
      const haveBefore = vaultAmount(vault, row.key);
      const deficit = need > 0 && haveBefore < need;
      // Shared leftover after every ACTIVE upgrade (includes this card if active)
      const afterAll = vaultAmount(poolAfterActives, row.key);
      return {
        ...row,
        need,
        have: haveBefore,
        // If short: ResourceLines uses have + short. If OK: show afterAll remaining.
        left: deficit ? haveBefore - need : afterAll,
        deficit,
      };
    });
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

  // Clean lock reasons only (no calculation essays)
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
