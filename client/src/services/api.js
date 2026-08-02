/**
 * API base URL
 * - Dev default: http://localhost:5000/api
 * - Production: set VITE_API_URL to your API host, e.g. https://api.example.com
 *   (with or without trailing /api — both work)
 */
function resolveApiBase() {
	// Empty VITE_API_URL → same origin /api (Vercel full-stack or Vite proxy)
	const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
	if (!raw) return '/api';
	return raw.endsWith('/api') ? raw : `${raw}/api`;
}
const BASE = resolveApiBase();

function getToken() {
	try {
		return sessionStorage.getItem('kingshot_token') || '';
	} catch {
		return '';
	}
}
async function request(path, options = {}, tokenOverride) {
	const token = tokenOverride !== undefined ? tokenOverride : getToken();
	const headers = {
		'Content-Type': 'application/json',
		...(options.headers || {}),
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${BASE}${path}`, {
		...options,
		headers
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error(data.message || data.error || res.statusText);
		err.status = res.status;
		err.code = data.code;
		err.data = data;
		throw err;
	}
	return data;
}
export const api = {
	get: (path, token) => request(path, {}, token),
	post: (path, body, token) => request(path, {
		method: 'POST',
		body: JSON.stringify(body)
	}, token),
	put: (path, body, token) => request(path, {
		method: 'PUT',
		body: JSON.stringify(body)
	}, token),
	delete: (path, token) => request(path, {
		method: 'DELETE'
	}, token),
};
export async function listPresets() {
	return api.get('/presets');
}
export async function getPreset(name) {
	return api.get(`/presets/${encodeURIComponent(name)}`);
}
export async function createPreset(body) {
	// allow string name or full body
	if (typeof body === 'string') {
		return api.post('/presets', {
			name: body
		});
	}
	return api.post('/presets', body);
}
export async function updatePreset(name, body) {
	return api.put(`/presets/${encodeURIComponent(name)}`, body);
}
export async function deletePreset(name) {
	return api.delete(`/presets/${encodeURIComponent(name)}`);
}
/** Reset preset fields to empty (keeps name) — used by AppContext resetCurrent */
export async function resetPreset(name) {
	const empty = {
		vault: {},
		troops: {},
		buildings: {},
		heroes: {},
		heroGear: {},
		govGear: {},
		govCharm: {},
		pets: {},
		warAcademy: {},
		widgets: {},
		misc: {},
		heroShards: {},
		heroWidgets: {},
		lockedUpgrades: {},
		settings: {},
		pageScores: {},
	};
	return api.put(`/presets/${encodeURIComponent(name)}`, empty);
}
export async function fetchGameData(type) {
	return api.get(`/data/${type}`);
}
/** Alias used by useGameData.js */
export async function getCollection(collection) {
	return api.get(`/data/${collection}`);
}
export async function register(body) {
	return api.post('/auth/register', body);
}
export async function login(body) {
	return api.post('/auth/login', body);
}
export async function me() {
	return api.get('/auth/me');
}
