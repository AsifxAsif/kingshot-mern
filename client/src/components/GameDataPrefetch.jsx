import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ensureCatalogFresh, prefetchGameData } from '../hooks/useGameData';

/**
 * On login: compare server catalog version → auto-clear stale caches
 * (works on phone; no manual DevTools steps), then warm catalogs.
 */
export default function GameDataPrefetch() {
	const { isAuthenticated, authReady } = useAuth();
	useEffect(() => {
		if (!authReady || !isAuthenticated) return;
		let cancelled = false;
		(async () => {
			await ensureCatalogFresh();
			if (!cancelled) prefetchGameData();
		})();
		return () => {
			cancelled = true;
		};
	}, [authReady, isAuthenticated]);
	return null;
}
