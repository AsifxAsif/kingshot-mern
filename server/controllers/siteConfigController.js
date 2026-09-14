import {
	SiteConfig
} from '../models/SiteConfig.js';
export async function getSiteConfig(req, res) {
	try {
		let doc = await SiteConfig.findOne({
			key: 'default'
		}).lean();
		if (!doc) {
			doc = {
				key: 'default',
				orders: {}
			};
		}
		res.json({
			orders: doc.orders || {},
			updatedAt: doc.updatedAt || null
		});
	} catch (e) {
		console.error('getSiteConfig', e.message);
		res.status(500).json({
			error: 'Failed to load site config'
		});
	}
}
