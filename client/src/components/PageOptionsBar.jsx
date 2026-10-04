import { useApp } from '../context/AppContext';

/**
 * Shared page toolbar: prerequisite toggle + show/hide-maxed toggle.
 * Single place for style and placement on every calculator page.
 */
export default function PageOptionsBar({
  className = '',
  /** Show "Enforce prerequisite checks" */
  showPrereq = false,
  prereqEnabled = true,
  onPrereqChange,
  prereqTitle = 'When on, Upgrade is blocked until prerequisites are met',
  /** Show maxed control when the page has at least one maxed item */
  hasMaxed = false,
  /** Label for maxed toggle (default matches other pages) */
  maxedLabel = 'Show maxed items',
  maxedTitle = 'When off, cards already at max level are hidden',
  /**
   * Optional: invert storage meaning (Masters used "hide maxed").
   * When true, checkbox is "Hide maxed skills" and checked means hidden.
   */
  hideMaxedMode = false,
  hideMaxed = false,
  onHideMaxedChange,
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
  const showMaxedControl = hideMaxedMode
    ? hasMaxed && typeof onHideMaxedChange === 'function'
    : hasMaxed;

  if (!showPrereqControl && !showMaxedControl) {
    return null;
  }

  return (
    <div className={`page-options-bar show-maxed-bar ${className}`.trim()}>
      {showPrereqControl ? (
        <label className="checkbox-label page-options-label show-maxed-label" title={prereqTitle}>
          <input
            className="checkbox"
            type="checkbox"
            checked={!!prereqEnabled}
            onChange={(e) => onPrereqChange(e.target.checked)}
          />
          <span>Enforce prerequisite checks</span>
        </label>
      ) : null}

      {showMaxedControl && !hideMaxedMode ? (
        <label className="checkbox-label page-options-label show-maxed-label" title={maxedTitle}>
          <input
            className="checkbox"
            type="checkbox"
            checked={showMaxed}
            onChange={(e) => setShowMaxed(e.target.checked)}
          />
          <span>{maxedLabel}</span>
        </label>
      ) : null}

      {showMaxedControl && hideMaxedMode ? (
        <label
          className="checkbox-label page-options-label show-maxed-label"
          title="When on, skill cards already at max level are hidden"
        >
          <input
            className="checkbox"
            type="checkbox"
            checked={!!hideMaxed}
            onChange={(e) => onHideMaxedChange?.(e.target.checked)}
          />
          <span>Hide maxed skills</span>
        </label>
      ) : null}

      {!hideMaxedMode && hasMaxed && !showMaxed ? (
        <small className="show-maxed-hint page-options-hint">Maxed cards are hidden</small>
      ) : null}
    </div>
  );
}
