import { useEffect, useState } from 'react';
import { getCollection, getCatalogVersion } from '../services/api';

const cache = new Map();
const inflight = new Map();
const LS_PREFIX = 'ks_gamedata_v5_';
const VERSION_KEY = 'ks_catalog_version';
const LS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // soft TTL only; version wins over TTL

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
			if (k && (k.startsWith('ks_gamedata_') || k.startsWith(LS_PREFIX) || k === VERSION_KEY)) {
				localStorage.removeItem(k);
			}
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
		const payload = JSON.stringify({ __ts: Date.now(), data });
		localStorage.setItem(LS_PREFIX + name, payload);
		sessionStorage.setItem(LS_PREFIX + name, payload);
	} catch {
		try {
			sessionStorage.setItem(LS_PREFIX + name, JSON.stringify({ __ts: Date.now(), data }));
		} catch {
			/* quota */
		}
	}
}

/**
 * Fetch one collection from the API.
 * @param {string} name
 * @param {{ force?: boolean }} [opts] - force=true always hits the network
 */
async function fetchCollection(name, opts = {}) {
	const force = !!opts.force;
	if (!force && cache.has(name)) return cache.get(name);
	if (!force && inflight.has(name)) return inflight.get(name);

	const p = getCollection(name)
		.then((data) => {
			cache.set(name, data);
			writeStored(name, data);
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

/**
 * Compare server catalog version to the one stored in the browser.
 * If they differ (or missing), wipe all game-data caches so the next
 * fetch loads the upgraded Masters.json / other catalogs automatically.
 * Safe to call on every login / app open — including phones.
 */
export async function ensureCatalogFresh() {
	try {
		const { version } = await getCatalogVersion();
		if (!version) return;
		let stored = null;
		try {
			stored = localStorage.getItem(VERSION_KEY);
		} catch {
			/* ignore */
		}
		if (stored !== version) {
			clearGameDataCache();
			try {
				localStorage.setItem(VERSION_KEY, version);
			} catch {
				/* ignore */
			}
		}
	} catch {
		// Offline / 401 — keep existing cache; do not block the app
	}
}

/** Prefetch catalogs in background (call after login). */
export function prefetchGameData(collections) {
	const list =
		collections ||
		[
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
		fetchCollection(c, { force: true }).catch(() => {});
	});
}

export function useGameData(collection) {
	// Hydrate memory cache from localStorage synchronously on first use
	if (!cache.has(collection)) {
		const stored = readStored(collection);
		if (stored) cache.set(collection, stored);
	}
	const [data, setData] = useState(() => cache.get(collection) || null);
	const [loading, setLoading] = useState(() => !cache.has(collection));
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			// Always re-check catalog version once per mount cycle so
			// seed/redeploy invalidates without the user clearing storage.
			await ensureCatalogFresh();
			if (cancelled) return;

			if (cache.has(collection)) {
				setData(cache.get(collection));
				setLoading(false);
				setError(null);
				// Soft revalidate: always hit network after version check
				fetchCollection(collection, { force: true })
					.then((d) => {
						if (!cancelled) setData(d);
					})
					.catch(() => {});
				return;
			}

			setLoading(true);
			try {
				const d = await fetchCollection(collection, { force: true });
				if (!cancelled) {
					setData(d);
					setError(null);
				}
			} catch (e) {
				if (!cancelled) {
					const msg =
						e.status === 401 ? 'Login required to load game data' : e.message || 'Failed to load';
					setError(msg);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [collection]);

	return {
		data,
		loading: loading && !data,
		error,
	};
}
