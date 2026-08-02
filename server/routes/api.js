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
// Auth — brute-force limited
router.post('/auth/register', authLimiter, authController.register);
router.post('/auth/login', authLimiter, authController.login);
router.get('/auth/me', authController.authOptional, authController.me);
router.use(authController.authOptional);
// Game data (read-only)
router.get('/data/:collection', dataController.getCollection);
// Presets
router.get('/presets', presetController.listPresets);
router.get('/presets/:name', presetController.getPreset);
router.post('/presets', writeLimiter, presetController.createPreset);
router.put('/presets/:name', writeLimiter, presetController.updatePreset);
router.delete('/presets/:name', writeLimiter, presetController.deletePreset);
export default router;
