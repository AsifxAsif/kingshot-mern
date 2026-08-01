/**
 * Current / Target selects — order follows data path (not alpha rank).
 * Supports numeric, TG, stars (Green⭐), and pet "10_Advancement".
 */

function isPureNumber(s) {
  return /^-?\d+(\.\d+)?$/.test(String(s).trim());
}

function levelRank(v) {
  const s = String(v);
  if (isPureNumber(s)) return parseFloat(s);
  // 10_Advancement → 10.5 so it sits between 10 and 11
  const adv = s.match(/^(\d+(?:\.\d+)?)[_ ]?Advancement$/i);
  if (adv) return parseFloat(adv[1]) + 0.5;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function sortLevels(list) {
  const arr = Array.from(new Set((list || []).map((l) => String(l))));
  const numericish = arr.filter((l) => levelRank(l) != null).length >= Math.ceil(arr.length * 0.5);
  if (!numericish) {
    // Keep original order (gov gear Green → Green⭐ → Blue …)
    return arr;
  }
  return arr.sort((a, b) => {
    const ra = levelRank(a);
    const rb = levelRank(b);
    if (ra != null && rb != null && ra !== rb) return ra - rb;
    if (ra != null && rb == null) return -1;
    if (ra == null && rb != null) return 1;
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
}) {
  const list = sortLevels(levels || []);
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

  // Target = any level after current in ordered list (allows 1 → 11, 10 → 10_Advancement)
  const targetOpts =
    fromIdx < 0 ? list : list.filter((_, i) => i > fromIdx);

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
