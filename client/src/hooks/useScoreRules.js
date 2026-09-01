import {
	useMemo
} from 'react';
import {
	useApp
} from '../context/AppContext';
import {
	getScoreRules,
	normalizeEventId,
	EVENTS
} from '../utils/events';
/** Live score table for the currently selected event */
export function useScoreRules() {
	const {
		state
	} = useApp();
	const eventId = normalizeEventId(state.settings?.activeEvent || 'sg') || 'sg';
	const epoch = Number(state.settings?.scoreEpoch) || 0;
	const rules = useMemo(() => getScoreRules(eventId), [eventId, epoch]);
	return {
		eventId,
		event: EVENTS[eventId] || EVENTS.sg,
		scoreRules: rules,
		scoreEpoch: epoch
	};
}
export default useScoreRules;
