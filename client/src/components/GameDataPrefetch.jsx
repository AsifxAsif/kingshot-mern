import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { prefetchGameData } from '../hooks/useGameData';

/** Warm game-data cache as soon as the user is authenticated. */
export default function GameDataPrefetch() {
  const { isAuthenticated, authReady } = useAuth();
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    prefetchGameData();
  }, [authReady, isAuthenticated]);
  return null;
}
