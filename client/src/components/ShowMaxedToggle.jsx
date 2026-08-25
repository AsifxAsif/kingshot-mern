import { useApp } from '../context/AppContext';
import { convertLevelToNumeric } from '../utils/calc';

/** True when current level is at the highest option in `levels`. */
export function isAtMaxLevel(from, levels = []) {
  if (!levels?.length) return false;
  const max = levels[levels.length - 1];
  return convertLevelToNumeric(from ?? '0') >= convertLevelToNumeric(max);
}

/**
 * Shared control: show / hide cards that are already at max level.
 * Only renders when `hasMaxed` is true (page currently has ≥1 maxed item).
 */
export default function ShowMaxedToggle({ className = '', hasMaxed = false }) {
  const { state, updateSection } = useApp();
  const showMaxed = state.settings?.showMaxedItems !== false;

  if (!hasMaxed) return null;

  const setShow = (checked) => {
    updateSection('settings', (prev) => ({
      ...(prev || {}),
      showMaxedItems: checked,
    }));
  };

  return (
    <div className={`show-maxed-bar ${className}`.trim()}>
      <label
        className="checkbox-label show-maxed-label"
        title="When off, cards already at max level are hidden"
      >
        <input
          className="checkbox" type="checkbox"
          checked={showMaxed}
          onChange={(e) => setShow(e.target.checked)}
        />
        {' '}
        Show maxed items
      </label>
      {!showMaxed && (
        <small className="show-maxed-hint">Maxed cards are hidden</small>
      )}
    </div>
  );
}

/** Hook: whether maxed items should be visible (default true). */
export function useShowMaxedItems() {
  const { state } = useApp();
  return state.settings?.showMaxedItems !== false;
}
