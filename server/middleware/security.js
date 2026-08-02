import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import cors from 'cors';
/** Allowed browser origins (comma-separated in env) */
export function buildCors() {
	const raw = process.env.CORS_ORIGINS || process.env.CLIENT_URL || '';
	const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
	// Vercel preview + production patterns if none set
	const origin = list.length ? (origin, cb) => {
		if (!origin) return cb(null, true); // same-origin / curl
		if (list.includes(origin)) return cb(null, true);
		if (list.some((o) => o.includes('*') && origin.endsWith(o.replace('*', '')))) {
			return cb(null, true);
		}
		// allow vercel.app previews if enabled
		if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && /\.vercel\.app$/.test(origin)) {
			return cb(null, true);
		}
		return cb(new Error('Not allowed by CORS'));
	} : true; // dev default
	return cors({
		origin,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
		maxAge: 600,
	});
}
export function securityHeaders() {
	return helmet({
		contentSecurityPolicy: {
			useDefaults: true,
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
				styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
				imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
				fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
				connectSrc: ["'self'", ...(process.env.API_CSP_CONNECT || '').split(',').filter(Boolean)],
				objectSrc: ["'none'"],
				frameAncestors: ["'none'"],
				baseUri: ["'self'"],
				formAction: ["'self'"],
				upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
			},
		},
		crossOriginEmbedderPolicy: false, // SPA + external fonts/images
		crossOriginResourcePolicy: {
			policy: 'cross-origin'
		},
		referrerPolicy: {
			policy: 'strict-origin-when-cross-origin'
		},
		hsts: process.env.NODE_ENV === 'production' ? {
			maxAge: 31536000,
			includeSubDomains: true,
			preload: true
		} : false,
	});
}
/** Global API rate limit */
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: Number(process.env.RATE_LIMIT_API || 400),
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: 'Too many requests. Please try again later.'
	},
});
/** Strict limit for login/register — brute-force protection */
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: Number(process.env.RATE_LIMIT_AUTH || 20),
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	message: {
		error: 'Too many auth attempts. Try again in 15 minutes.'
	},
});
/** Write operations (create/update presets) */
export const writeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: Number(process.env.RATE_LIMIT_WRITE || 120),
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: 'Too many write requests. Slow down.'
	},
});
export function sanitizeMongo() {
	// Strips $ and . from user input keys — blocks NoSQL operator injection
	return mongoSanitize({
		replaceWith: '_',
		allowDots: false,
	});
}
export function preventParamPollution() {
	return hpp({
		whitelist: [], // reject duplicate query params for all keys
	});
}
/** Block common probe paths */
export function blockProbes(req, res, next) {
	const p = (req.path || '').toLowerCase();
	const blocked = ['/wp-admin', '/wp-login', '/.env', '/.git', '/phpmyadmin', '/admin', '/xmlrpc.php', '/actuator', ];
	if (blocked.some((b) => p.startsWith(b))) {
		return res.status(404).json({
			error: 'Not found'
		});
	}
	next();
}
