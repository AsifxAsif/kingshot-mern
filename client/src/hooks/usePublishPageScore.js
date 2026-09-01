import {
	useEffect
} from 'react';
import {
	useApp
} from '../context/AppContext';
import {
	useScoreRules
} from './useScoreRules';
/**
 * Publish a page total into global pageScores.
 * Re-runs whenever the value changes OR the active event changes
 * (so switching SG/KvK/AB never leaves scores stuck at 0).
 */
export function usePublishPageScore(pageKey, score) {
	const {
		setPageScore,
		state
	} = useApp();
	const {
		eventId
	} = useScoreRules();
	const epoch = state.settings?.scoreEpoch;
	useEffect(() => {
		setPageScore(pageKey, score);
	}, [pageKey, score, eventId, epoch, setPageScore]);
}
export default usePublishPageScore;
