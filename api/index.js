/**
 * Vercel serverless entry — Express under /api/*
 * Runtime secrets come from Vercel Environment Variables (not server/.env).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../server/config/db.js';
import app from '../server/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only load local files; never override vars already set by Vercel
function loadLocalEnv(filePath) {
	try {
		if (fs.existsSync(filePath)) {
			dotenv.config({ path: filePath, override: false });
		}
	} catch {
		/* ignore */
	}
}
loadLocalEnv(path.join(__dirname, '../server/.env'));
loadLocalEnv(path.join(__dirname, '../.env'));

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
				'Set MONGODB_URI in Vercel → Settings → Environment Variables (Production + Preview), allow Atlas 0.0.0.0/0, Redeploy.',
		});
	}

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
