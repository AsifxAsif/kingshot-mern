import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
	sanitizeEmail,
	sanitizeUsername,
	sanitizePassword,
	sanitizeGameId,
	assertNoOperators,
} from '../utils/validate.js';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_DAYS = process.env.JWT_DAYS || '7d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

function requireSecret() {
	if (!JWT_SECRET || JWT_SECRET === 'kingshot-dev-secret-change-me') {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('JWT_SECRET must be set in production');
		}
	}
	return JWT_SECRET || 'kingshot-dev-secret-change-me';
}

function signToken(user) {
	return jwt.sign({
		id: String(user._id),
		username: user.username
	}, requireSecret(), {
		expiresIn: JWT_DAYS,
		issuer: 'kingshot-api',
		audience: 'kingshot-client',
	});
}
export async function register(req, res) {
	try {
		assertNoOperators(req.body || {});
		const username = sanitizeUsername(req.body?.username);
		const email = sanitizeEmail(req.body?.email);
		const password = sanitizePassword(req.body?.password);
		const gameId = sanitizeGameId(req.body?.gameId ?? '') ?? '';
		if (!username || !email || !password) {
			return res.status(400).json({
				error: 'Valid username (3–32 chars), email, and password (8+ chars, letters+numbers) required',
			});
		}
		const exists = await User.findOne({
			$or: [{
				email
			}, {
				username
			}],
		}).lean();
		if (exists) return res.status(409).json({
			error: 'User already exists'
		});
		const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
		const user = await User.create({
			username,
			email,
			passwordHash,
			gameId,
		});
		const token = signToken(user);
		res.status(201).json({
			token,
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				gameId: user.gameId || '',
			},
		});
	} catch (err) {
		if (err.message === 'Invalid field name' || err.message === 'Payload too deep') {
			return res.status(400).json({
				error: 'Invalid request'
			});
		}
		console.error('register error');
		res.status(500).json({
			error: 'Registration failed'
		});
	}
}
export async function login(req, res) {
	try {
		assertNoOperators(req.body || {});
		const raw = String(req.body?.email || req.body?.username || '').trim();
		const password = String(req.body?.password || '');
		if (!raw || !password) {
			return res.status(400).json({
				error: 'email/username and password required'
			});
		}
		if (password.length > 128) {
			return res.status(400).json({
				error: 'Invalid credentials'
			});
		}
		const email = sanitizeEmail(raw);
		const query = email ? {
			email
		} : {
			username: sanitizeUsername(raw) || '__invalid__'
		};
		const user = await User.findOne(query);
		// constant-ish response timing: always hash compare path
		const hash = user?.passwordHash || '$2a$12$invalidhashinvalidhashinvalidho';
		const ok = await bcrypt.compare(password, hash);
		if (!user || !ok) {
			return res.status(401).json({
				error: 'Invalid credentials'
			});
		}
		const token = signToken(user);
		res.json({
			token,
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				gameId: user.gameId || '',
			},
		});
	} catch (err) {
		if (err.message === 'Invalid field name' || err.message === 'Payload too deep') {
			return res.status(400).json({
				error: 'Invalid request'
			});
		}
		console.error('login error');
		res.status(500).json({
			error: 'Login failed'
		});
	}
}
export async function me(req, res) {
	if (!req.user) return res.status(401).json({
		error: 'Not authenticated'
	});
	try {
		const full = await User.findById(req.user.id).select('username email gameId').lean();
		if (!full) return res.status(401).json({
			error: 'User not found'
		});
		res.json({
			user: {
				id: full._id,
				username: full.username,
				email: full.email,
				gameId: full.gameId || '',
			},
		});
	} catch {
		res.status(500).json({
			error: 'Failed'
		});
	}
}
export function authOptional(req, res, next) {
	const header = req.headers.authorization || '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : null;
	if (!token) {
		req.user = null;
		return next();
	}
	try {
		const payload = jwt.verify(token, requireSecret(), {
			issuer: 'kingshot-api',
			audience: 'kingshot-client',
		});
		req.user = {
			id: payload.id,
			username: payload.username
		};
	} catch {
		req.user = null;
	}
	next();
}
export function authRequired(req, res, next) {
	authOptional(req, res, () => {
		if (!req.user) return res.status(401).json({
			error: 'Authentication required'
		});
		next();
	});
}
