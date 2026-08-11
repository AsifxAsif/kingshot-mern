import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    console.log('MongoDB ready');
  } catch (e) {
    // Allow local dev without Mongo — game data serves from server/data/*.json
    console.warn('MongoDB unavailable:', e.message);
    console.warn('Serving game data from local JSON files. Auth/presets need MongoDB.');
  }

  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}

start();
