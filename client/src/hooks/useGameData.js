import { useEffect, useState } from 'react';
import { getCollection } from '../services/api';

const cache = new Map();
const inflight = new Map();
const LS_PREFIX = 'ks_gamedata_v2_';

export function clearGameDataCache() {
	cache.clear();
	inflight.clear();
	try {
		const keys = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const k = sessionStorage.key(i);
			if (k && k.startsWith(LS_PREFIX)) keys.push(k);
		}
		keys.forEach((k) => sessionStorage.removeItem(k));
	} catch {
		/* ignore */
	}
}

function readSession(name) {
	try {
		const raw = sessionStorage.getItem(LS_PREFIX + name);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function writeSession(name, data) {
	try {
		sessionStorage.setItem(LS_PREFIX + name, JSON.stringify(data));
	} catch {
		/* quota */
	}
}

async function fetchCollection(name) {
	if (cache.has(name)) return cache.get(name);
	if (inflight.has(name)) return inflight.get(name);

	const p = getCollection(name)
		.then((data) => {
			cache.set(name, data);
			writeSession(name, data);
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

/** Prefetch catalogs in background (call after login). */
export function prefetchGameData(collections) {
	const list = collections || [
		'heroes',
		'hero_gears',
		'forgehammers',
		'buildings',
		'troops',
		'war_academy',
		'masters',
		'widgets',
		'pets',
		'misc',
		'gov_gears',
		'gov_charms',
		'points',
	];
	list.forEach((c) => {
		fetchCollection(c).catch(() => {});
	});
}

export function useGameData(collection) {
	const sessionHit = !cache.has(collection) ? readSession(collection) : null;
	if (sessionHit && !cache.has(collection)) {
		cache.set(collection, sessionHit);
	}

	const [data, setData] = useState(() => cache.get(collection) || null);
	const [loading, setLoading] = useState(() => !cache.has(collection));
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;
		if (cache.has(collection)) {
			setData(cache.get(collection));
			setLoading(false);
			setError(null);
			// soft revalidate in background
			fetchCollection(collection)
				.then((d) => {
					if (!cancelled) setData(d);
				})
				.catch(() => {});
			return () => {
				cancelled = true;
			};
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
