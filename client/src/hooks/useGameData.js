import {
	useEffect,
	useState
} from 'react';
import {
	getCollection
} from '../services/api';
const cache = new Map();
const inflight = new Map();
const LS_PREFIX = 'ks_gamedata_v3_';
const LS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days browser cache
export function clearGameDataCache() {
	cache.clear();
	inflight.clear();
	try {
		const keys = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const k = sessionStorage.key(i);
			if (k && (k.startsWith('ks_gamedata_') || k.startsWith(LS_PREFIX))) keys.push(k);
		}
		keys.forEach((k) => sessionStorage.removeItem(k));
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const k = localStorage.key(i);
			if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
		}
	} catch {
		/* ignore */
	}
}

function readStored(name) {
	try {
		const raw = localStorage.getItem(LS_PREFIX + name) || sessionStorage.getItem(LS_PREFIX + name);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed && parsed.__ts && Date.now() - parsed.__ts > LS_TTL_MS) return null;
		return parsed?.data ?? parsed;
	} catch {
		return null;
	}
}

function writeStored(name, data) {
	try {
		const payload = JSON.stringify({
			__ts: Date.now(),
			data
		});
		localStorage.setItem(LS_PREFIX + name, payload);
		sessionStorage.setItem(LS_PREFIX + name, payload);
	} catch {
		try {
			sessionStorage.setItem(LS_PREFIX + name, JSON.stringify({
				__ts: Date.now(),
				data
			}));
		} catch {
			/* quota */
		}
	}
}
async function fetchCollection(name) {
	if (cache.has(name)) return cache.get(name);
	if (inflight.has(name)) return inflight.get(name);
	const p = getCollection(name).then((data) => {
		cache.set(name, data);
		writeStored(name, data);
		inflight.delete(name);
		return data;
	}).catch((e) => {
		inflight.delete(name);
		throw e;
	});
	inflight.set(name, p);
	return p;
}
/** Prefetch catalogs in background (call after login). */
export function prefetchGameData(collections) {
	const list = collections || ['heroes', 'hero_gears', 'forgehammers', 'buildings', 'troops', 'war_academy', 'masters', 'widgets', 'pets', 'misc', 'gov_gears', 'gov_charms', 'points', ];
	list.forEach((c) => {
		fetchCollection(c).catch(() => {});
	});
}
export function useGameData(collection) {
	// Hydrate memory cache from localStorage synchronously on first use
	if (!cache.has(collection)) {
		const stored = readStored(collection);
		if (stored) cache.set(collection, stored);
	}
	const [data, setData] = useState(() => cache.get(collection) || null);
	// Only "loading" when we have nothing to show yet
	const [loading, setLoading] = useState(() => !cache.has(collection));
	const [error, setError] = useState(null);
	useEffect(() => {
		let cancelled = false;
		if (cache.has(collection)) {
			setData(cache.get(collection));
			setLoading(false);
			setError(null);
			// Soft revalidate in background — do not set loading true
			fetchCollection(collection).then((d) => {
				if (!cancelled) setData(d);
			}).catch(() => {});
			return () => {
				cancelled = true;
			};
		}
		setLoading(true);
		fetchCollection(collection).then((d) => {
			if (!cancelled) {
				setData(d);
				setError(null);
			}
		}).catch((e) => {
			if (!cancelled) {
				const msg = e.status === 401 ? 'Login required to load game data' : e.message || 'Failed to load';
				setError(msg);
			}
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [collection]);
	return {
		data,
		loading: loading && !data, // never block UI if cached data exists
		error
	};
}
