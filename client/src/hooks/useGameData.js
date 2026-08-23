import { useEffect, useState } from 'react';
import { getCollection } from '../services/api';

const cache = new Map();
const inflight = new Map();

/** Clear in-memory game-data cache (e.g. on logout) */
export function clearGameDataCache() {
  cache.clear();
  inflight.clear();
}

async function fetchCollection(name) {
  if (cache.has(name)) return cache.get(name);
  if (inflight.has(name)) return inflight.get(name);
  const p = getCollection(name)
    .then((data) => {
      cache.set(name, data);
      inflight.delete(name);
      return data;
    })
    .catch((e) => {
      inflight.delete(name);
      throw e;
    });
  inflight.set(name, p);
  return p;
}

export function useGameData(collection) {
  const [data, setData] = useState(() => cache.get(collection) || null);
  const [loading, setLoading] = useState(() => !cache.has(collection));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(collection)) {
      setData(cache.get(collection));
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    fetchCollection(collection)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          const msg =
            e.status === 401
              ? 'Login required to load game data'
              : e.message || 'Failed to load';
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  return { data, loading, error };
}
