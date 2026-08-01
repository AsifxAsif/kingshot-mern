/**
 * Vercel serverless entry — Express app
 * Routes: /api/* → this function
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../server/config/db.js';
import app from '../server/app.js';

// Load server/.env when running locally via vercel dev
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

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
    console.error(e);
    return res.status(500).json({ error: 'Database unavailable' });
  }
  return app(req, res);
}
