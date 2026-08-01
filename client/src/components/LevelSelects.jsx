/**
 * Current / Target level selects (original site behavior)
 * - Placeholders are not real values
 * - Selecting Current auto-picks next higher as Target
 * - Target options only levels > current
 * - Safe controlled values (never stuck / unselectable)
 */

function levelRank(v) {
  const s = String(v);
  // pure number
  const n = parseFloat(s);
  if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(s.trim())) return n;
  // TG-style or mixed: pull first number sequence
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function sortLevels(list) {
  return [...list].sort((a, b) => {
    const ra = levelRank(a);
    const rb = levelRank(b);
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
}) {
  const list = sortLevels(Array.from(new Set((levels || []).map((l) => String(l)))));
  const maxLevel =
    highest != null && highest !== ''
      ? String(highest)
      : list.length
        ? list[list.length - 1]
        : '';

  const fromStr = from === '' || from == null ? '' : String(from);
  let toStr = to === '' || to == null ? '' : String(to);

  // If controlled value is not in list, treat as empty so select works
  const fromValid = fromStr === '' || list.includes(fromStr);
  const safeFrom = fromValid ? fromStr : '';

  const isMaxed = safeFrom !== '' && maxLevel !== '' && safeFrom === maxLevel;

  const targetOpts = list.filter((l) => {
    if (safeFrom === '') return true;
    return levelRank(l) > levelRank(safeFrom);
  });

  // If current `to` is invalid for target list, show placeholder
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
    // auto next higher level
    const next = list.find((l) => levelRank(l) > levelRank(val));
    onTo(next || '');
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
