import express from 'express';
import morgan from 'morgan';
import apiRoutes from './routes/api.js';
import {
	buildCors,
	securityHeaders,
	apiLimiter,
	sanitizeMongo,
	preventParamPollution,
	blockProbes,
} from './middleware/security.js';
const isProd = process.env.NODE_ENV === 'production';
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders());
app.use(buildCors());
app.use(express.json({
	limit: process.env.JSON_LIMIT || '2mb'
}));
app.use(express.urlencoded({
	extended: false,
	limit: '100kb'
}));
app.use(sanitizeMongo());
app.use(preventParamPollution());
app.use(blockProbes);
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use('/api', apiLimiter);
// Public health (before auth-protected routes)
app.get('/api/health', (req, res) => {
	const hasKey = Boolean(
		(process.env.MIGHTPULSE_API_KEY ||
			process.env.MIGHT_PULSE_API_KEY ||
			process.env.PLAYER_API_KEY ||
			process.env.KSS_API_KEY ||
			'').trim()
	);
	res.status(200).json({
		ok: true,
		env: process.env.VERCEL ? 'vercel' : 'local',
		vercelEnv: process.env.VERCEL_ENV || null,
		hasMightpulseKey: hasKey,
		hasMongoUri: Boolean((process.env.MONGODB_URI || '').trim()),
		hasJwtSecret: Boolean((process.env.JWT_SECRET || '').trim()),
	});
});
app.use('/api', apiRoutes);
app.get('/api', (req, res) => {
	res.status(401).json({ error: 'Authentication required' });
});
app.get('/', (req, res) => {
	res.status(401).json({
		error: 'Authentication required'
	});
});
app.use((req, res) => {
	res.status(404).json({
		error: 'Not found'
	});
});
app.use((err, req, res, next) => {
	if (err.message === 'Not allowed by CORS') {
		return res.status(403).json({
			error: 'CORS blocked'
		});
	}
	console.error(err.message);
	res.status(err.status || 500).json({
		error: isProd ? 'Internal server error' : err.message,
	});
});
export default app;
