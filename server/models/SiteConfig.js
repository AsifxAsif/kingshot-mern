import mongoose from 'mongoose';
/**
 * Singleton site UI configuration (ordering of lists, etc.)
 * Same collection is read by the public app and written by local admin.
 */
const siteConfigSchema = new mongoose.Schema({
	key: {
		type: String,
		default: 'default',
		unique: true
	},
	/** { vault_resources: ['bread',...], navbar: ['/','/buildings',...], buildings: [...], ... } */
	orders: {
		type: mongoose.Schema.Types.Mixed,
		default: {}
	},
	updatedAt: {
		type: Date,
		default: Date.now
	},
}, {
	collection: 'site_config',
	timestamps: true
});
export const SiteConfig = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);
export default SiteConfig;
