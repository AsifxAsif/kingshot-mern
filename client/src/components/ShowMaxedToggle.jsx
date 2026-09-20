import { useApp } from '../context/AppContext';
import { convertLevelToNumeric } from '../utils/calc';
import PageOptionsBar from './PageOptionsBar';

/** True when current level is at the highest option in `levels`. */
export function isAtMaxLevel(from, levels = []) {
  if (!levels?.length) return false;
  const max = levels[levels.length - 1];
  return convertLevelToNumeric(from ?? '0') >= convertLevelToNumeric(max);
}

/**
 * Shared control: show / hide cards that are already at max level.
 * Renders via PageOptionsBar for consistent placement/style.
 */
export default function ShowMaxedToggle({ className = '', hasMaxed = false }) {
  return <PageOptionsBar className={className} hasMaxed={hasMaxed} />;
}

/** Hook: whether maxed items should be visible (default true). */
export function useShowMaxedItems() {
  const { state } = useApp();
  return state.settings?.showMaxedItems !== false;
}
