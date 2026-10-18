import { formatNumber, formatSecondsToTime } from '../utils/calc';
import AssetImg from './AssetImg';
import { resourceImg, resourceImgFallbacks } from '../utils/images';

const SPEEDUP_KEYS = new Set([
  'training_speedup',
  'building_speedup',
  'research_speedup',
  'master_speedup',
  'general_speedup',
]);

const SPEEDUP_LABELS = {
  training_speedup: 'Training speedup',
  building_speedup: 'Building speedup',
  research_speedup: 'Research speedup',
  master_speedup: 'Master speedup',
  general_speedup: 'General speedup',
};

function formatNeed(key, need) {
  if (need == null || need === '') return '';
  if (SPEEDUP_KEYS.has(key)) {
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
 * OK:     bread: 96M (3.78K in vault)
 * Short:  bread: 96M (have 0 · 96M short)
 */
export default function ResourceLines({ lines = [], active = false }) {
  if (!lines.length) return null;
  return (
    <div className="cost-grid">
      {lines.map((line) => {
        const key = line.key || line.label || '';
        let label = line.label;
        if (!label) {
          if (SPEEDUP_LABELS[key]) label = SPEEDUP_LABELS[key];
          else if (key.startsWith('master_emblem_')) {
            const name = key.slice('master_emblem_'.length);
            label = `${name.charAt(0).toUpperCase()}${name.slice(1)} emblem`;
          } else {
            label = String(key).replace(/_/g, ' ');
          }
        }
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
        const fallbacks = line.fallbacks || resourceImgFallbacks(key);

        let statusText = null;
        let statusClass = '';
        const needN = need != null && need !== '' ? Number(need) : null;
        const haveN = have != null ? Number(have) : null;
        const leftN = left != null ? Number(left) : haveN != null && needN != null ? haveN - needN : null;

        // Short when need exceeds what is in the shared vault pool
        const isShort =
          deficit === true ||
          (needN != null && haveN != null && needN > haveN) ||
          (leftN != null && leftN < 0);

        const shortAmt =
          isShort && needN != null && haveN != null
            ? Math.max(0, needN - haveN)
            : isShort && leftN != null
              ? Math.abs(leftN)
              : null;

        if (isShort) {
          // e.g. (have 180 · 105 short)
          const parts = [];
          if (haveN != null) parts.push(`have ${formatAmt(key, haveN)}`);
          if (shortAmt != null) parts.push(`${formatAmt(key, shortAmt)} short`);
          statusText = parts.length ? parts.join(' · ') : 'short';
          statusClass = 'text-deficit';
        } else if (leftN != null) {
          statusText = `${formatAmt(key, leftN)} remaining`;
          statusClass = 'text-remaining';
        } else if (haveN != null) {
          statusText = `${formatAmt(key, haveN)} in vault`;
          statusClass = 'text-remaining';
        }

        return (
          <div
            key={`${key}-${label}`}
            className={`cost-line${deficit ? ' cost-line-deficit' : ' cost-line-ok'}`}
          >
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
