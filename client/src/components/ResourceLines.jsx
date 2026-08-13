import { formatNumber, formatSecondsToTime } from '../utils/calc';
import AssetImg from './AssetImg';
import { resourceImg } from '../utils/images';

const SPEEDUP_KEYS = new Set([
  'training_speedup',
  'building_speedup',
  'research_speedup',
  'master_speedup',
  'general_speedup',
]);

function formatNeed(key, need) {
  if (need == null || need === '') return '';
  if (SPEEDUP_KEYS.has(key)) {
    // stored as minutes → show as time string
    const secs = Math.round(Number(need) * 60);
    return formatSecondsToTime(secs);
  }
  return formatNumber(need);
}

function formatAmt(key, n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  if (SPEEDUP_KEYS.has(key)) {
    return formatSecondsToTime(Math.round(Math.abs(Number(n)) * 60));
  }
  return formatNumber(Math.abs(Number(n)));
}

/**
 * Shared cost rows.
 * lines: [{ key, need, have?, left?, deficit?, label?, img?, fallbacks? }]
 * active: when true → "X remaining"; when false → "X in vault"
 */
export default function ResourceLines({ lines = [], active = false }) {
  if (!lines.length) return null;
  return (
    <div className="cost-grid">
      {lines.map((line) => {
        const key = line.key || line.label || '';
        const label = line.label || String(key).replace(/_/g, ' ');
        const need = line.need;
        const have = line.have != null ? Number(line.have) : null;
        const left =
          line.left != null
            ? Number(line.left)
            : have != null && need != null
              ? have - Number(need)
              : null;
        const deficit =
          line.deficit != null
            ? line.deficit
            : left != null
              ? left < 0
              : have != null && need != null
                ? have < Number(need)
                : false;
        const img = line.img || resourceImg(key);
        const fallbacks = line.fallbacks || [];

        let statusText = null;
        let statusClass = '';
        if (active && left != null) {
          statusText = deficit
            ? `${formatAmt(key, left)} short`
            : `${formatAmt(key, left)} remaining`;
          statusClass = deficit ? 'text-deficit' : 'text-remaining';
        } else if (have != null) {
          statusText = `${formatAmt(key, have)} in vault`;
          statusClass = deficit ? 'text-deficit' : 'text-remaining';
        } else if (left != null) {
          statusText = deficit
            ? `${formatAmt(key, left)} short`
            : `${formatAmt(key, left)} remaining`;
          statusClass = deficit ? 'text-deficit' : 'text-remaining';
        }

        return (
          <div key={`${key}-${label}`} className={`cost-line${deficit ? ' cost-line-deficit' : ' cost-line-ok'}`}>
            <AssetImg src={img} fallbacks={fallbacks} size={20} alt={label} />
            <span className="cost-line-label">
              {label}
              {need != null && need !== '' ? `: ${formatNeed(key, need)}` : ''}
            </span>
            {statusText && <span className={statusClass}>({statusText})</span>}
          </div>
        );
      })}
    </div>
  );
}
