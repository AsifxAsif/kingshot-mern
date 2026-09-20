import { useApp } from '../context/AppContext';

/**
 * Shared page toolbar: prerequisite toggle + show-maxed toggle.
 * Always the same placement/style at the top of calculator content.
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

  const showMaxedControl = hideMaxedMode ? true : hasMaxed;
  // In hideMaxedMode always show the control when hasMaxed; in normal mode only if hasMaxed
  if (!showPrereq && !hasMaxed && !(hideMaxedMode && hasMaxed)) {
    return null;
  }

  return (
    <div className={`page-options-bar show-maxed-bar ${className}`.trim()}>
      {showPrereq && typeof onPrereqChange === 'function' ? (
        <label className="checkbox-label show-maxed-label" title={prereqTitle}>
          <input
            className="checkbox"
            type="checkbox"
            checked={!!prereqEnabled}
            onChange={(e) => onPrereqChange(e.target.checked)}
          />{' '}
          Enforce prerequisite checks
        </label>
      ) : null}

      {hasMaxed && !hideMaxedMode ? (
        <label className="checkbox-label show-maxed-label" title={maxedTitle}>
          <input
            className="checkbox"
            type="checkbox"
            checked={showMaxed}
            onChange={(e) => setShowMaxed(e.target.checked)}
          />{' '}
          {maxedLabel}
        </label>
      ) : null}

      {hasMaxed && hideMaxedMode ? (
        <label
          className="checkbox-label show-maxed-label"
          title="When on, skill cards already at max level are hidden"
        >
          <input
            className="checkbox"
            type="checkbox"
            checked={!!hideMaxed}
            onChange={(e) => onHideMaxedChange?.(e.target.checked)}
          />{' '}
          Hide maxed skills
        </label>
      ) : null}

      {!hideMaxedMode && hasMaxed && !showMaxed ? (
        <small className="show-maxed-hint">Maxed cards are hidden</small>
      ) : null}
    </div>
  );
}
