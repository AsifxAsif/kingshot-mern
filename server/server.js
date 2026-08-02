import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';
dotenv.config();
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
	app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}).catch((e) => {
	console.error('DB connection failed', e.message);
	process.exit(1);
});
