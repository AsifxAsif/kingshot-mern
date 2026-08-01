/**
 * Current / Target selects — matches original site ordering:
 * numeric, TG1/TG1-1…, pet 10_Advancement, gov Green→Blue stars
 */
import { convertLevelToNumeric } from '../utils/calc';

function sortLevels(list, preserveOrder = false) {
  const arr = Array.from(new Set((list || []).map((l) => String(l))));
  if (preserveOrder) return arr;
  // If values are mostly non-numeric labels (gov gear colors), keep insertion order
  const numericCount = arr.filter((l) => {
    const s = String(l).trim();
    return (
      /^-?\d+(\.\d+)?$/.test(s) ||
      /^TG\d+/i.test(s) ||
      /Advancement/i.test(s)
    );
  }).length;
  if (numericCount < Math.ceil(arr.length * 0.4)) return arr;
  return arr.sort((a, b) => {
    const ra = convertLevelToNumeric(a);
    const rb = convertLevelToNumeric(b);
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b));
  });
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
      ? String(highest)
      : list.length
        ? list[list.length - 1]
        : '';

  const fromStr = from === '' || from == null ? '' : String(from);
  const toStr = to === '' || to == null ? '' : String(to);

  const fromValid = fromStr === '' || list.includes(fromStr);
  const safeFrom = fromValid ? fromStr : '';
  const fromIdx = safeFrom === '' ? -1 : list.indexOf(safeFrom);
  const isMaxed = safeFrom !== '' && maxLevel !== '' && safeFrom === maxLevel;

  // All levels after current in ordered list (1→11, 10→10_Advancement, Green→Blue)
  const targetOpts = fromIdx < 0 ? list : list.filter((_, i) => i > fromIdx);

  const toValid = toStr !== '' && targetOpts.includes(toStr);
  const safeTo = isMaxed ? maxLevel : toValid ? toStr : '';

  const handleFrom = (val) => {
    onFrom(val);
    if (!val) {
      onTo('');
      return;
    }
    if (maxLevel && val === maxLevel) {
      onTo(maxLevel);
      return;
    }
    const idx = list.indexOf(val);
    const next = idx >= 0 && idx + 1 < list.length ? list[idx + 1] : '';
    onTo(next);
  };

  return (
    <>
      <div className="level-controls">
        <select
          value={safeFrom}
          disabled={disabled}
          onChange={(e) => handleFrom(e.target.value)}
        >
          <option value="">Current Level</option>
          {list.map((l) => (
            <option key={`c-${l}`} value={l}>
              {l === maxLevel ? `${l} (Max)` : l}
            </option>
          ))}
        </select>
        <select
          value={safeTo}
          disabled={disabled || isMaxed}
          onChange={(e) => onTo(e.target.value)}
        >
          <option value="">Target Level</option>
          {isMaxed ? (
            <option value={maxLevel}>{maxLevel} (Max)</option>
          ) : (
            targetOpts.map((l) => (
              <option key={`t-${l}`} value={l}>
                {l === maxLevel ? `${l} (Max)` : l}
              </option>
            ))
          )}
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
