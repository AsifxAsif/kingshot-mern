import {
	Router
} from 'express';
import * as dataController from '../controllers/dataController.js';
import * as presetController from '../controllers/presetController.js';
import * as authController from '../controllers/authController.js';
import {
	authLimiter,
	writeLimiter
} from '../middleware/security.js';
const router = Router();
// ── Public (no auth): login / register only ──────────────────────────────
router.post('/auth/register', authLimiter, authController.register);
router.post('/auth/login', authLimiter, authController.login);
// ── Authenticated routes ─────────────────────────────────────────────────
// All routes below require a valid Bearer JWT
router.use(authController.authRequired);
router.get('/auth/me', authController.me);
// Game data (was public — now login required)
router.get('/data/:collection', dataController.getCollection);
// Presets (already user-scoped; now hard-require login at middleware level)
router.get('/presets', presetController.listPresets);
router.get('/presets/:name', presetController.getPreset);
router.post('/presets', writeLimiter, presetController.createPreset);
router.put('/presets/:name', writeLimiter, presetController.updatePreset);
router.post('/presets/:name/rename', writeLimiter, presetController.renamePreset);
router.delete('/presets/:name', writeLimiter, presetController.deletePreset);
export default router;
