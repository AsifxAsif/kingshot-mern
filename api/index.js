/**
 * Vercel serverless entry — Express + MongoDB
 */
import dotenv from 'dotenv';
import path from 'path';
import {
	fileURLToPath
} from 'url';
import connectDB from '../server/config/db.js';
import app from '../server/app.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.join(__dirname, '../server/.env')
});
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
			error: 'Database unavailable',
			detail: e?.message || String(e),
			hint: 'Set MONGODB_URI in Vercel → Settings → Environment Variables (Production + Preview), allow Atlas IP 0.0.0.0/0, then Redeploy. Prefer the standard mongodb:// shard URI if mongodb+srv fails.',
		});
	}
	return app(req, res);
}
