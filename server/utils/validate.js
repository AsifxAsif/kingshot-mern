import validator from 'validator';
const USERNAME_RE = /^[a-zA-Z0-9_\-.]{3,32}$/;
/** Kingshot player ID is numeric only */
const GAME_ID_RE = /^[0-9]{1,20}$/;
export function cleanString(v, max = 200) {
	if (v == null) return '';
	let s = String(v);
	// strip control chars
	s = s.replace(/[\u0000-\u001F\u007F]/g, '');
	s = validator.trim(s);
	if (s.length > max) s = s.slice(0, max);
	return s;
}
export function sanitizeEmail(email) {
	const e = cleanString(email, 254).toLowerCase();
	if (!validator.isEmail(e)) return null;
	return validator.normalizeEmail(e) || e;
}
export function sanitizeUsername(username) {
	const u = cleanString(username, 32);
	if (!USERNAME_RE.test(u)) return null;
	return u;
}
export function sanitizePassword(password) {
	const p = String(password ?? '');
	if (p.length < 8 || p.length > 128) return null;
	// require some strength
	if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return null;
	return p;
}
export function sanitizeGameId(gameId) {
	const g = cleanString(gameId, 64);
	if (!GAME_ID_RE.test(g)) return null;
	return g;
}
export function sanitizePresetName(name) {
	const n = cleanString(name, 48);
	if (!n || n.length < 1) return null;
	// no path / injection characters
	if (/[\/\\$<>{}]/.test(n)) return null;
	return n;
}
/** Reject objects that look like Mongo operator injection after body parse */
export function assertNoOperators(value, depth = 0) {
	if (depth > 12) throw new Error('Payload too deep');
	if (value && typeof value === 'object') {
		if (Array.isArray(value)) {
			for (const item of value) assertNoOperators(item, depth + 1);
			return;
		}
		for (const key of Object.keys(value)) {
			if (key.startsWith('$') || key.includes('.')) {
				throw new Error('Invalid field name');
			}
			assertNoOperators(value[key], depth + 1);
		}
	}
}
