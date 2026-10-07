import { useApp } from '../context/AppContext';

/**
 * Shared page toolbar: prerequisite + show-maxed toggles (same on every page).
 */
export default function PageOptionsBar({
  className = '',
  showPrereq = false,
  prereqEnabled = true,
  onPrereqChange,
  prereqTitle = 'When on, upgrades respect prerequisites',
  hasMaxed = false,
}) {
  const { state, updateSection } = useApp();
  const showMaxed = state.settings?.showMaxedItems !== false;

  const setShowMaxed = (checked) => {
    updateSection('settings', (prev) => ({
      ...(prev || {}),
      showMaxedItems: checked,
    }));
  };

  const showPrereqControl = showPrereq && typeof onPrereqChange === 'function';
  const showMaxedControl = !!hasMaxed;

  if (!showPrereqControl && !showMaxedControl) {
    return null;
  }

  return (
    <div className={`page-options-bar show-maxed-bar ${className}`.trim()}>
      <div className="page-options-row">
        {showPrereqControl ? (
          <label
            className="checkbox-label page-options-label show-maxed-label"
            title={prereqTitle}
          >
            <input
              className="checkbox"
              type="checkbox"
              checked={!!prereqEnabled}
              onChange={(e) => onPrereqChange(e.target.checked)}
            />
            <span>Enable prerequisite</span>
          </label>
        ) : null}

        {showMaxedControl ? (
          <label
            className="checkbox-label page-options-label show-maxed-label"
            title="When off, items already at max level are hidden"
          >
            <input
              className="checkbox"
              type="checkbox"
              checked={showMaxed}
              onChange={(e) => setShowMaxed(e.target.checked)}
            />
            <span>Show maxed items</span>
          </label>
        ) : null}
      </div>

      {!showMaxed && hasMaxed ? (
        <small className="show-maxed-hint page-options-hint">Maxed items are hidden</small>
      ) : null}
    </div>
  );
}
