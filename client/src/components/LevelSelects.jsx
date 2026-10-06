/**
 * Current / Target selects.
 * - Target only lists levels strictly above Current
 * - Changing Current auto-sets Target to the next level
 */
import { convertLevelToNumeric } from '../utils/calc';

function sortLevels(list, preserveOrder = false) {
  const arr = Array.from(new Set((list || []).map((l) => String(l ?? '').trim()).filter(Boolean)));
  if (preserveOrder) return arr;
  const numericCount = arr.filter((l) => {
    const s = String(l).trim();
    return /^-?\d+(\.\d+)?$/.test(s) || /^TG\d+/i.test(s) || /Advancement/i.test(s);
  }).length;
  if (numericCount < Math.ceil(arr.length * 0.4)) return arr;
  return arr.sort((a, b) => {
    const ra = convertLevelToNumeric(a);
    const rb = convertLevelToNumeric(b);
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b));
  });
}

/** Resolve value to an index in list (string / number tolerant). */
function indexOfLevel(list, val) {
  const s = val === '' || val == null ? '' : String(val).trim();
  if (!s) return -1;
  const exact = list.indexOf(s);
  if (exact >= 0) return exact;
  for (let i = 0; i < list.length; i++) {
    if (String(list[i]).trim() === s) return i;
  }
  const rank = convertLevelToNumeric(s);
  if (Number.isFinite(rank)) {
    for (let i = 0; i < list.length; i++) {
      if (convertLevelToNumeric(list[i]) === rank) return i;
    }
  }
  return -1;
}

/** Levels strictly higher than current (order first, then numeric rank). */
function higherLevels(list, fromIdx, fromStr) {
  if (fromIdx >= 0) {
    return list.slice(fromIdx + 1);
  }
  if (!fromStr) return [];
  const rank = convertLevelToNumeric(fromStr);
  if (!Number.isFinite(rank)) return [];
  return list.filter((l) => convertLevelToNumeric(l) > rank);
}

export function LevelSelects({
  levels,
  from,
  to,
  onFrom,
  onTo,
  highest,
  disabled = false,
  preserveOrder = false,
}) {
  const list = sortLevels(levels || [], preserveOrder);
  const maxLevel =
    highest != null && highest !== ''
      ? String(highest).trim()
      : list.length
        ? list[list.length - 1]
        : '';

  const fromStr = from === '' || from == null ? '' : String(from).trim();
  const toStr = to === '' || to == null ? '' : String(to).trim();

  const fromIdx = indexOfLevel(list, fromStr);
  const safeFrom = fromIdx >= 0 ? list[fromIdx] : '';
  const isMaxed = fromIdx >= 0 && fromIdx === list.length - 1;

  const targetOpts = isMaxed ? (maxLevel ? [maxLevel] : []) : higherLevels(list, fromIdx, safeFrom || fromStr);

  let safeTo = '';
  if (isMaxed) {
    safeTo = maxLevel || (list.length ? list[list.length - 1] : '');
  } else if (toStr) {
    const ti = indexOfLevel(targetOpts, toStr);
    if (ti >= 0) safeTo = targetOpts[ti];
  }

  const handleFrom = (val) => {
    const v = val == null ? '' : String(val).trim();
    onFrom?.(v);
    if (!v) {
      onTo?.('');
      return;
    }
    const idx = indexOfLevel(list, v);
    if (idx < 0) {
      onTo?.('');
      return;
    }
    if (idx >= list.length - 1) {
      onTo?.(list[idx]);
      return;
    }
    // Always bump target to the next higher level
    onTo?.(list[idx + 1]);
  };

  const handleTo = (val) => {
    const v = val == null ? '' : String(val).trim();
    onTo?.(v);
  };

  return (
    <>
      <div className="level-controls">
        <select
          value={safeFrom}
          disabled={disabled}
          onChange={(e) => handleFrom(e.target.value)}
          aria-label="Current level"
        >
          <option value="">Current Level</option>
          {list.map((l) => (
            <option key={`c-${l}`} value={l}>
              {indexOfLevel(list, l) === list.length - 1 ? `${l} (Max)` : l}
            </option>
          ))}
        </select>
        <select
          value={safeTo}
          disabled={disabled || isMaxed || (!safeFrom && targetOpts.length === 0)}
          onChange={(e) => handleTo(e.target.value)}
          aria-label="Target level"
        >
          <option value="">{safeFrom ? 'Target Level' : 'Select current first'}</option>
          {targetOpts.map((l) => (
            <option key={`t-${l}`} value={l}>
              {indexOfLevel(list, l) === list.length - 1 ? `${l} (Max)` : l}
            </option>
          ))}
        </select>
      </div>
      {isMaxed && (
        <div className="status-pane status-ok" style={{ marginBottom: 8 }}>
          Maxed — no further upgrades
        </div>
      )}
    </>
  );
}
