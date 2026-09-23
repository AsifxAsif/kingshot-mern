const DANGEROUS_RE = /[=;'"`\\]|--|\/\*|\*\/|\b(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|SCRIPT)\b/i;
export const KNOWN_EMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'aol.com', 'mail.com', 'zoho.com', 'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com', 'hey.com', 'pm.me', ]);
export function hasDangerousInput(value) {
	return DANGEROUS_RE.test(String(value ?? ''));
}
export function sanitizeFieldInput(value, {
	digitsOnly = false,
	maxLen = 128
} = {}) {
	let s = String(value ?? '');
	if (digitsOnly) s = s.replace(/\D/g, '');
	else s = s.replace(/[\u0000-\u001F\u007F]/g, '');
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}
export function validateUsername(username) {
	const u = String(username ?? '').trim();
	if (hasDangerousInput(u)) return {
		ok: false,
		error: 'Username contains invalid characters'
	};
	if (u.length < 3 || u.length > 32) return {
		ok: false,
		error: 'Username must be 3–32 characters'
	};
	if (!/^[a-zA-Z0-9_\-.]+$/.test(u)) return {
		ok: false,
		error: 'Username: letters, numbers, _ - . only'
	};
	return {
		ok: true,
		value: u
	};
}
export function validateEmail(email, {
	loginMode = false
} = {}) {
	const raw = String(email ?? '').trim();
	if (!raw) return {
		ok: false,
		error: 'Email is required'
	};
	if (hasDangerousInput(raw)) return {
		ok: false,
		error: 'Email contains invalid characters'
	};
	if (loginMode && !raw.includes('@')) {
		const u = validateUsername(raw);
		if (u.ok) return {
			ok: true,
			value: u.value,
			isUsername: true
		};
		return {
			ok: false,
			error: 'Enter a valid email or username'
		};
	}
	const e = raw.toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return {
		ok: false,
		error: 'Email must include @ and a domain'
	};
	const domain = e.split('@').pop();
	if (!KNOWN_EMAIL_DOMAINS.has(domain)) return {
		ok: false,
		error: 'Use a well-known email provider (Gmail, Yahoo, Outlook, …)'
	};
	return {
		ok: true,
		value: e
	};
}
export function validatePassword(password) {
	const p = String(password ?? '');
	if (hasDangerousInput(p)) return {
		ok: false,
		error: 'Password contains invalid characters'
	};
	if (p.length < 8 || p.length > 128) return {
		ok: false,
		error: 'Password must be 8–128 characters'
	};
	if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return {
		ok: false,
		error: 'Password needs letters and numbers'
	};
	return {
		ok: true,
		value: p
	};
}
export function validateGameId(gameId) {
	const g = String(gameId ?? '').replace(/\D/g, '');
	if (!g) return {
		ok: false,
		error: 'Player UID is required (numbers only)'
	};
	if (g.length < 7) return {
		ok: false,
		error: 'Player UID must be at least 7 digits'
	};
	if (g.length > 20) return {
		ok: false,
		error: 'Player UID is too long'
	};
	return {
		ok: true,
		value: g
	};
}
