/**
 * Player proxy: official v1 API + site profile (tg_info, upload_image).
 * Keys stay server-side: MIGHTPULSE_API_KEY
 */
const MIGHTPULSE_API = 'https://api.mightpulse.com/v1';
const MIGHTPULSE_SITE = 'https://mightpulse.com/api';

const SITE_HEADERS = {
	Accept: 'application/json',
	Origin: 'https://mightpulse.com',
	Referer: 'https://mightpulse.com/',
	'User-Agent': 'Kingshot/1.0',
};

/** In-memory player payload cache (per server instance). TTL keeps UI fast between visits. */
const PLAYER_CACHE = new Map();
const PLAYER_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const UID_CACHE = new Map(); // gameId -> { uid, expires }

function cacheGet(key) {
	const hit = PLAYER_CACHE.get(key);
	if (!hit) return null;
	if (hit.expires <= Date.now()) {
		PLAYER_CACHE.delete(key);
		return null;
	}
	return hit.body;
}

function cacheSet(key, body) {
	PLAYER_CACHE.set(key, { expires: Date.now() + PLAYER_CACHE_TTL_MS, body });
}

function cacheClearGame(gameId) {
	const g = String(gameId || '');
	for (const key of [...PLAYER_CACHE.keys()]) {
		if (key.startsWith(`${g}|`)) PLAYER_CACHE.delete(key);
	}
	UID_CACHE.delete(g);
}

function getApiKey() {
	const key = (
		process.env.MIGHTPULSE_API_KEY ||
		process.env.MIGHT_PULSE_API_KEY ||
		process.env.PLAYER_API_KEY ||
		process.env.KSS_API_KEY ||
		''
	).trim();
	return key || null;
}

async function loadUserGameId(req) {
	const user = req.user;
	if (!user?.id) return { error: 'Unauthorized', status: 401 };
	let gameId = (user.gameId || '').toString().trim();
	if (!gameId) {
		const User = (await import('../models/User.js')).default;
		const full = await User.findById(user.id).select('gameId').lean();
		gameId = (full?.gameId || '').toString().trim();
	}
	if (!gameId) {
		return {
			error: 'No Game ID on your account. Your Kingshot Governor ID is required.',
			status: 400,
		};
	}
	return { gameId, user };
}

/**
 * Site player profile — includes tg_info.short (TG5), upload_image, etc.
 * GET https://mightpulse.com/api/players/{uid}
 */
async function fetchSiteProfile(uid) {
	if (!uid) return null;
	try {
		const url = `${MIGHTPULSE_SITE}/players/${encodeURIComponent(uid)}`;
		const res = await fetch(url, { method: 'GET', headers: SITE_HEADERS });
		if (!res.ok) return null;
		return await res.json().catch(() => null);
	} catch {
		return null;
	}
}

/**
 * Merge site fields (tg_info, upload_image, …) onto v1 payload.player
 */
function mergeSiteIntoPayload(payload, site) {
	if (!payload || !site) return payload;
	const player = payload.player && typeof payload.player === 'object' ? { ...payload.player } : {};

	if (site.tg_info) {
		player.tg_info = site.tg_info;
	}
	if (site.upload_image && !player.upload_image) {
		player.upload_image = site.upload_image;
	}
	if (site.image && !player.image) {
		player.image = site.image;
	}
	// Keep stove_lv if useful
	if (site.stove_lv != null && player.stove_lv == null) {
		player.stove_lv = site.stove_lv;
	}

	return {
		...payload,
		player,
		// also expose at root for convenience
		tg_info: site.tg_info || payload.tg_info || null,
	};
}

async function fetchPlayerPayload(gameId, include, { bypassCache = false } = {}) {
	const apiKey = getApiKey();
	if (!apiKey) {
		const flags = {
			MIGHTPULSE_API_KEY: Boolean((process.env.MIGHTPULSE_API_KEY || '').trim()),
			MIGHT_PULSE_API_KEY: Boolean((process.env.MIGHT_PULSE_API_KEY || '').trim()),
			PLAYER_API_KEY: Boolean((process.env.PLAYER_API_KEY || '').trim()),
			KSS_API_KEY: Boolean((process.env.KSS_API_KEY || '').trim()),
			VERCEL: Boolean(process.env.VERCEL),
			VERCEL_ENV: process.env.VERCEL_ENV || null,
		};
		console.error('[player] API key missing. Env flags:', flags);
		return {
			status: 503,
			body: {
				ok: false,
				error: 'Player API key not configured',
				detail:
					'MIGHTPULSE_API_KEY is not visible to the Vercel function. Open Vercel → Settings → Environment Variables → add MIGHTPULSE_API_KEY for Production AND Preview → save → Deployments → Redeploy (not only "retry"). Check /api/health for hasMightpulseKey.',
				code: 'MISSING_PLAYER_API_KEY',
				flags,
			},
		};
	}

	const includeStr = include || 'base,heroes,ranks';
	const cacheKey = `${gameId}|${includeStr}`;
	if (!bypassCache) {
		const cached = cacheGet(cacheKey);
		if (cached) {
			return {
				status: 200,
				body: { ...cached, cached: true, cacheAgeMs: undefined },
			};
		}
	}

	const params = new URLSearchParams({ include: includeStr });
	const url = `${MIGHTPULSE_API}/players/${encodeURIComponent(gameId)}?${params}`;

	// Start site profile in parallel (try governor id first; refine with uid if needed)
	const sitePromise = fetchSiteProfile(gameId);

	const upstream = await fetch(url, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			Accept: 'application/json',
		},
	});
	const data = await upstream.json().catch(() => ({}));
	if (!upstream.ok) {
		const status = upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 502;
		return {
			status,
			body: {
				ok: false,
				error:
					data?.error ||
					data?.message ||
					(upstream.status === 404
						? 'Player not found for this Governor ID'
						: upstream.status === 429
							? 'Rate limit exceeded — try again shortly'
							: 'Failed to load player data'),
				status: upstream.status,
			},
		};
	}

	let body = {
		ok: true,
		gameId,
		fetchedAt: new Date().toISOString(),
		...data,
	};

	const uid = String(body.uid ?? body.player?.uid ?? gameId);
	UID_CACHE.set(String(gameId), { uid, expires: Date.now() + PLAYER_CACHE_TTL_MS });

	try {
		let site = await sitePromise;
		if (!site && uid && uid !== String(gameId)) {
			site = await fetchSiteProfile(uid);
		}
		if (site) body = mergeSiteIntoPayload(body, site);
	} catch (e) {
		console.warn('[player] site profile skip:', e?.message || e);
	}

	cacheSet(cacheKey, body);
	return { status: 200, body };
}

/** Resolve uid for site refresh endpoints (prefer API wrapper uid). */
async function resolveUid(gameId) {
	const g = String(gameId);
	const hit = UID_CACHE.get(g);
	if (hit && hit.expires > Date.now() && hit.uid) {
		return { gameId: g, uid: String(hit.uid) };
	}
	// Prefer cached full payload over a new upstream call
	const cached =
		cacheGet(`${g}|base,heroes,ranks`) ||
		cacheGet(`${g}|base`) ||
		null;
	if (cached) {
		const uid = String(cached.uid ?? cached.player?.uid ?? g);
		UID_CACHE.set(g, { uid, expires: Date.now() + PLAYER_CACHE_TTL_MS });
		return { gameId: g, uid, playerPayload: cached };
	}
	const result = await fetchPlayerPayload(g, 'base');
	if (result.status !== 200) return { gameId: g, uid: g };
	const uid = String(result.body?.uid ?? result.body?.player?.uid ?? g);
	UID_CACHE.set(g, { uid, expires: Date.now() + PLAYER_CACHE_TTL_MS });
	return { gameId: g, uid, playerPayload: result.body };
}

/**
 * GET /api/player
 */
export async function getPlayer(req, res) {
	try {
		const loaded = await loadUserGameId(req);
		if (loaded.error) return res.status(loaded.status).json({ ok: false, error: loaded.error });
		const include =
			(req.query.include || 'base,heroes,ranks').toString().trim() || 'base,heroes,ranks';
		const result = await fetchPlayerPayload(loaded.gameId, include);
		return res.status(result.status).json(result.body);
	} catch (err) {
		console.error('[player]', err.message);
		return res.status(500).json({ ok: false, error: 'Failed to load player data' });
	}
}

/**
 * GET /api/player/refresh-status
 */
export async function getRefreshStatus(req, res) {
	try {
		const loaded = await loadUserGameId(req);
		if (loaded.error) return res.status(loaded.status).json({ ok: false, error: loaded.error });

		const { uid } = await resolveUid(loaded.gameId);
		const url = `${MIGHTPULSE_SITE}/players/${encodeURIComponent(uid)}/refresh/status`;
		const upstream = await fetch(url, { method: 'GET', headers: SITE_HEADERS });
		const data = await upstream.json().catch(() => ({}));
		return res.status(upstream.ok ? 200 : upstream.status === 429 ? 200 : upstream.status).json({
			ok: data.ok !== false,
			uid,
			gameId: loaded.gameId,
			cooldown_remaining_sec: Number(data.cooldown_remaining_sec) || 0,
			cooldown_total_sec: Number(data.cooldown_total_sec) || 600,
			queued: !!data.queued,
			started: !!data.started,
			position: data.position ?? 0,
			ahead: data.ahead ?? 0,
			wait_sec: data.wait_sec ?? 0,
			eta_sec: data.eta_sec ?? null,
			via: data.via || 'site',
			raw: data,
		});
	} catch (err) {
		console.error('[refresh-status]', err.message);
		return res.status(500).json({ ok: false, error: 'Failed to load refresh status' });
	}
}

/**
 * POST /api/player/refresh
 */
export async function postRefresh(req, res) {
	try {
		const loaded = await loadUserGameId(req);
		if (loaded.error) return res.status(loaded.status).json({ ok: false, error: loaded.error });

		const { uid } = await resolveUid(loaded.gameId);
		const statusUrl = `${MIGHTPULSE_SITE}/players/${encodeURIComponent(uid)}/refresh/status`;
		const refreshUrl = `${MIGHTPULSE_SITE}/players/${encodeURIComponent(uid)}/refresh`;
		const siteHeaders = {
			...SITE_HEADERS,
			Referer: `https://mightpulse.com/player/${uid}`,
			'Content-Type': 'application/json',
		};

		const statusRes = await fetch(statusUrl, { method: 'GET', headers: siteHeaders });
		const statusData = await statusRes.json().catch(() => ({}));
		const remaining = Number(statusData.cooldown_remaining_sec) || 0;

		if (remaining > 1 && !statusData.queued && !statusData.started) {
			return res.status(429).json({
				ok: false,
				error: 'cooldown',
				cooldown_remaining_sec: remaining,
				cooldown_total_sec: Number(statusData.cooldown_total_sec) || 600,
				detail: statusData.detail || `Wait ${Math.ceil(remaining)}s before refreshing again`,
			});
		}

		if (!statusData.queued && !statusData.started) {
			const startRes = await fetch(refreshUrl, {
				method: 'POST',
				headers: siteHeaders,
				body: '{}',
			});
			const startData = await startRes.json().catch(() => ({}));
			if (startRes.status === 429 || startData.error === 'cooldown') {
				return res.status(429).json({
					ok: false,
					error: 'cooldown',
					cooldown_remaining_sec: Number(startData.cooldown_remaining_sec) || remaining,
					cooldown_total_sec: Number(startData.cooldown_total_sec) || 600,
					detail: startData.detail || 'Refresh on cooldown',
				});
			}
		}

		const deadline = Date.now() + 25000;
		let lastStatus = statusData;
		while (Date.now() < deadline) {
			await new Promise((r) => setTimeout(r, 1500));
			const poll = await fetch(statusUrl, { method: 'GET', headers: siteHeaders });
			lastStatus = await poll.json().catch(() => ({}));
			if (!lastStatus.queued && !lastStatus.started) break;
		}

		const include =
			(req.query.include || 'base,heroes,ranks').toString().trim() || 'base,heroes,ranks';
		cacheClearGame(loaded.gameId);
		const result = await fetchPlayerPayload(loaded.gameId, include, { bypassCache: true });
		if (result.status !== 200) {
			return res.status(result.status).json(result.body);
		}
		return res.json({
			...result.body,
			refresh: {
				uid,
				cooldown_remaining_sec: Number(lastStatus.cooldown_remaining_sec) || 0,
				cooldown_total_sec: Number(lastStatus.cooldown_total_sec) || 600,
				queued: !!lastStatus.queued,
				started: !!lastStatus.started,
			},
		});
	} catch (err) {
		console.error('[refresh]', err.message);
		return res.status(500).json({ ok: false, error: 'Failed to refresh player data' });
	}
}
