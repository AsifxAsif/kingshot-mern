import {
	useEffect,
	useState,
	useMemo
} from 'react';
import {
	api
} from '../services/api';
/**
 * Load admin-managed UI order maps from GET /api/site-config
 * { vault_resources: string[], navbar: string[], buildings: string[], ... }
 */
export function useSiteConfig() {
	const [orders, setOrders] = useState({});
	const [loaded, setLoaded] = useState(false);
	useEffect(() => {
		let cancelled = false;
		api.get('/site-config').then((data) => {
			if (!cancelled) setOrders(data?.orders || {});
		}).catch(() => {
			if (!cancelled) setOrders({});
		}).finally(() => {
			if (!cancelled) setLoaded(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	return {
		orders,
		loaded
	};
}
/** Reorder `items` by id list; unknown ids append at end in original relative order */
export function applyOrder(items, orderIds, getId = (x) => x.id || x) {
	if (!Array.isArray(items) || !items.length) return items || [];
	if (!Array.isArray(orderIds) || !orderIds.length) return items;
	const map = new Map();
	items.forEach((it, idx) => {
		map.set(String(getId(it)), {
			it,
			idx
		});
	});
	const used = new Set();
	const out = [];
	for (const id of orderIds) {
		const key = String(id);
		const hit = map.get(key);
		if (hit) {
			out.push(hit.it);
			used.add(key);
		}
	}
	const rest = items.filter((it) => !used.has(String(getId(it))));
	return out.concat(rest);
}
