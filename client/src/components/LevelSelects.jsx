import { convertLevelToNumeric } from '../utils/calc';

function getDisplayLevel(level) {
  if (level === undefined || level === null || level === '') return '';
  const s = String(level);
  const advMatch = s.match(/^(\d+)_Advancement$/i);
  if (advMatch) {
    const num = parseInt(advMatch[1], 10);
    if (num === 10) return '10_Advancement';
    if (num === 20) return '20_Advancement';
    if (num === 30) return '30_Advancement';
    if (num === 40) return '40_Advancement';
    if (num === 50) return '50_Advancement';
    if (num === 60) return '60_Advancement';
    if (num === 70) return '70_Advancement';
    if (num === 80) return '80_Advancement';
    if (num === 90) return '90_Advancement';
    if (num === 100) return '100_Advancement';
    return s;
  }
  return s;
}

function sortLevelsWithTG(levels) {
  if (!levels || !levels.length) return [];
  return [...levels].sort((a, b) => {
    const na = convertLevelToNumeric(a);
    const nb = convertLevelToNumeric(b);
    if (na !== nb) return na - nb;
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
  // Ensure levels is always an array
  const levelList = levels || [];
  const list = preserveOrder ? [...levelList] : sortLevelsWithTG(levelList);
  const maxLevel = highest != null && highest !== '' ? String(highest) : list.length ? String(list[list.length - 1]) : '';

  // Convert from/to to strings for comparison
  const fromStr = from !== undefined && from !== null && from !== '' ? String(from) : '';
  const toStr = to !== undefined && to !== null && to !== '' ? String(to) : '';

  // Check if from value exists in list (as string comparison)
  const fromExists = fromStr !== '' && list.some(l => String(l) === fromStr);
  const safeFrom = fromExists ? fromStr : '';
  const fromIdx = safeFrom !== '' ? list.findIndex(l => String(l) === safeFrom) : -1;
  const isMaxed = safeFrom !== '' && maxLevel !== '' && safeFrom === maxLevel;

  // Target options: all levels after current index
  const targetOpts = fromIdx < 0 ? [] : list.filter((_, i) => i > fromIdx);

  // Check if to value exists in target options
  const toExists = toStr !== '' && targetOpts.some(l => String(l) === toStr);
  const safeTo = isMaxed ? maxLevel : toExists ? toStr : '';

  const handleFrom = (val) => {
    onFrom(val);
    if (!val || val === '') {
      onTo('');
      return;
    }
    if (maxLevel && val === maxLevel) {
      onTo(maxLevel);
      return;
    }
    const idx = list.findIndex(l => String(l) === val);
    const next = idx >= 0 && idx + 1 < list.length ? String(list[idx + 1]) : '';
    onTo(next);
  };

  const handleTo = (val) => {
    onTo(val);
  };

  return (
    <>
      <div className="level-controls">
        <select
          value={safeFrom}
          disabled={disabled}
          onChange={(e) => handleFrom(e.target.value)}
        >
          <option value="" disabled hidden>Current Level</option>
          {list.map((l) => {
            const lStr = String(l);
            const isMax = lStr === maxLevel;
            return (
              <option key={`c-${lStr}`} value={lStr}>
                {getDisplayLevel(lStr)}{isMax ? ' (Max)' : ''}
              </option>
            );
          })}
        </select>
        <select
          value={safeTo}
          disabled={disabled || isMaxed}
          onChange={(e) => handleTo(e.target.value)}
        >
          <option value="" disabled hidden>Target Level</option>
          {isMaxed ? (
            <option value={maxLevel}>{getDisplayLevel(maxLevel)} (Max)</option>
          ) : (
            targetOpts.map((l) => {
              const lStr = String(l);
              const isMax = lStr === maxLevel;
              return (
                <option key={`t-${lStr}`} value={lStr}>
                  {getDisplayLevel(lStr)}{isMax ? ' (Max)' : ''}
                </option>
              );
            })
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