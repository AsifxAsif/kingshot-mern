import { formatNumber } from '../utils/calc';
import AssetImg from './AssetImg';
import { resourceImg } from '../utils/images';

/**
 * Shared cost/resource rows used by CostStatus and inventory pages.
 * lines: [{ key, need, left?, deficit?, label?, img?, fallbacks? }]
 */
export default function ResourceLines({ lines = [] }) {
  if (!lines.length) return null;
  return (
    <div className="cost-grid">
      {lines.map((line) => {
        const key = line.key || line.label || '';
        const label = line.label || String(key).replace(/_/g, ' ');
        const need = line.need;
        const hasLeft = line.left != null && !Number.isNaN(Number(line.left));
        const left = hasLeft ? Number(line.left) : null;
        const deficit = line.deficit != null ? line.deficit : left != null && left < 0;
        const img = line.img || resourceImg(key);
        const fallbacks = line.fallbacks || [];
        return (
          <div
            key={`${key}-${label}`}
            className="cost-line"
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
          >
            <AssetImg src={img} fallbacks={fallbacks} size={20} alt={label} />
            <span>
              {label}
              {need != null && need !== '' ? `: ${formatNumber(need)}` : ''}
            </span>
            {hasLeft && (
              <span className={deficit ? 'text-deficit' : 'text-remaining'}>
                (
                {left >= 0
                  ? `${formatNumber(left)} left`
                  : `${formatNumber(Math.abs(left))} short`}
                )
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
