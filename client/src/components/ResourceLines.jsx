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

        let statusNode = null;
        if (isShort) {
          // (have 95 · 25 short) — have green, brackets/dot black, short red
          statusNode = (
            <span className="cost-status">
              (
              {haveN != null && (
                <span className="text-remaining">have {formatAmt(key, haveN)}</span>
              )}
              {haveN != null && shortAmt != null && (
                <span className="cost-status-sep" aria-hidden="true">·</span>
              )}
              {shortAmt != null ? (
                <span className="text-deficit">{formatAmt(key, shortAmt)} short</span>
              ) : (
                <span className="text-deficit">short</span>
              )}
              )
            </span>
          );
        } else if (leftN != null) {
          statusNode = (
            <span className="cost-status">
              (<span className="text-remaining">{formatAmt(key, leftN)} remaining</span>)
            </span>
          );
        } else if (haveN != null) {
          statusNode = (
            <span className="cost-status">
              (<span className="text-remaining">{formatAmt(key, haveN)} in vault</span>)
            </span>
          );
        }

        return (
          <div
            key={`${key}-${label}`}
            className={`cost-line${isShort || deficit ? ' cost-line-deficit' : ' cost-line-ok'}`}
          >
            <AssetImg src={img} fallbacks={fallbacks} size={20} alt={label} />
            <span className="cost-line-label">
              {label}
              {need != null && need !== '' ? `: ${formatNeed(key, need)}` : ''}
            </span>
            {statusNode}
          </div>
        );
      })}
    </div>
  );
}
