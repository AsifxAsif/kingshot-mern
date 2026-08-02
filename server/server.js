import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';
dotenv.config();
const PORT = process.env.PORT || 5000;
// For Vercel serverless, we need to connect on each request
let dbConnected = false;
async function ensureDB() {
	if (!dbConnected) {
		try {
			await connectDB();
			dbConnected = true;
		} catch (e) {
			console.error('DB connection failed:', e.message);
			throw e;
		}
	}
	return dbConnected;
}
// Export for Vercel serverless
export default async function handler(req, res) {
	try {
		await ensureDB();
	} catch (e) {
		return res.status(500).json({
			error: 'Database unavailable',
			detail: process.env.NODE_ENV === 'production' ? undefined : e.message,
			hint: 'Set MONGODB_URI in Vercel → Settings → Environment Variables',
		});
	}
	return app(req, res);
}
// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
	connectDB().then(() => {
		app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
	}).catch((e) => {
		console.error('DB connection failed', e.message);
		process.exit(1);
	});
}
