/**
 * Vercel serverless entry — Express API under /api/*
 * Env vars must be set in Vercel Dashboard (not only server/.env).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../server/config/db.js';
import app from '../server/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load local .env when present (dev). On Vercel, process.env is already populated.
dotenv.config({ path: path.join(__dirname, '../server/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

let ready;

async function ensureDB() {
	if (!ready) {
		ready = connectDB().catch((err) => {
			ready = null;
			throw err;
		});
	}
	return ready;
}

export default async function handler(req, res) {
	try {
		await ensureDB();
	} catch (e) {
		console.error('DB ensure failed:', e?.message || e);
		return res.status(500).json({
			ok: false,
			error: 'Database unavailable',
			detail: e?.message || String(e),
			hint:
				'Set MONGODB_URI in Vercel → Project → Settings → Environment Variables (Production + Preview). In Atlas, allow Network Access 0.0.0.0/0, then Redeploy.',
		});
	}

	// Ensure Express sees a normal /api/... path on all Vercel rewrite shapes
	try {
		const original = req.url || '/';
		if (original === '/api/index' || original.startsWith('/api/index?')) {
			const q = original.includes('?') ? original.slice(original.indexOf('?')) : '';
			req.url = '/api' + q;
		} else if (!original.startsWith('/api')) {
			req.url = '/api' + (original.startsWith('/') ? original : `/${original}`);
		}
	} catch {
		/* ignore */
	}

	return app(req, res);
}
