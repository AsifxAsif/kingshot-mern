import validator from 'validator';
const USERNAME_RE = /^[a-zA-Z0-9_\-.]{3,32}$/;
const GAME_ID_RE = /^[0-9]{7,20}$/;
const KNOWN_EMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'aol.com', 'mail.com', 'zoho.com', 'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com', 'hey.com', 'pm.me', ]);
const DANGEROUS_RE = /[=;'"`\\]|--|\/\*|\*\/|\b(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|SCRIPT)\b/i;
export function hasDangerousInput(value) {
	const s = String(value ?? '');
	if (!s) return false;
	return DANGEROUS_RE.test(s);
}
export function cleanString(v, max = 200) {
	if (v == null) return '';
	let s = String(v);
	s = s.replace(/[\u0000-\u001F\u007F]/g, '');
	s = validator.trim(s);
	if (s.length > max) s = s.slice(0, max);
	return s;
}
export function sanitizeEmail(email) {
	const e = cleanString(email, 254).toLowerCase();
	if (hasDangerousInput(e)) return null;
	if (!validator.isEmail(e)) return null;
	const domain = e.split('@').pop();
	if (!KNOWN_EMAIL_DOMAINS.has(domain)) return null;
	return validator.normalizeEmail(e) || e;
}
export function sanitizeUsername(username) {
	const u = cleanString(username, 32);
	if (hasDangerousInput(u)) return null;
	if (!USERNAME_RE.test(u)) return null;
	return u;
}
export function sanitizePassword(password) {
	const p = String(password ?? '');
	if (hasDangerousInput(p)) return null;
	if (p.length < 8 || p.length > 128) return null;
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
	if (/[\/\\$<>{}]/.test(n)) return null;
	if (hasDangerousInput(n)) return null;
	return n;
}
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
