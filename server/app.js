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
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(sanitizeMongo());
app.use(preventParamPollution());
app.use(blockProbes);
app.use(morgan(isProd ? 'combined' : 'dev'));

app.use('/api', apiLimiter);
app.use('/api', apiRoutes);

app.get('/api', (req, res) => {
  res.json({
    name: 'Kingshot Event Calculator API',
    version: '2.1.0',
    status: 'ok',
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node',
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Kingshot Event Calculator API',
    version: '2.1.0',
    status: 'ok',
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked' });
  }
  console.error(err.message);
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
});

export default app;
