const { all, get } = require('./db');

async function getItemFeaturesMap() {
	const rows = await all(`
		SELECT item_id, feature_id
		FROM item_features
	`);

	const map = new Map();

	for (const r of rows) {
		if (!map.has(r.item_id)) {
			map.set(r.item_id, new Set());
		}
		map.get(r.item_id).add(r.feature_id);
	}

	return map;
}

async function getFinalItemsForPlace(dayId, placeId, options = {}) {
	// 🔹 Дізнаємось дату і день тижня
	const day = await get(`
		SELECT date FROM days WHERE id = ?
	`, [dayId]);

	const jsDay = new Date(day.date).getDay();
	const dbDay = jsDay === 0 ? 7 : jsDay;

	const featureMap = await getItemFeaturesMap();
	const excludeNoPreparation = options.excludeNoPreparation || false;

	// 🔹 Беремо шаблон ТІЛЬКИ для цього weekday
	const base = await all(`
		SELECT 
			i.id AS item_id,
			i.name,
			pi.default_quantity
		FROM place_items pi
		JOIN items i ON i.id = pi.item_id

		WHERE pi.place_id = ?
			AND pi.weekday = ?

			AND (
				? = 0
				OR i.id NOT IN (
					SELECT item_id
					FROM item_features
					WHERE feature_id = 3
				)
			)
	`, [
		placeId,
		dbDay,
		excludeNoPreparation ? 1 : 0
	]);

	let filteredBase = base;

	if (excludeNoPreparation) {
		filteredBase = base.filter(item => {
			const features = featureMap.get(item.item_id);

			// якщо нема фіч — показуємо
			if (!features) return true;

			// 3 = no_preparation → виключаємо
			return !features.has(3);
		});
	}

	// 🔹 Всі дифи на цей день
	const diffs = await all(`
		SELECT * FROM day_items
		WHERE day_id = ? 
			AND place_id = ?
			AND is_custom = 0 
	`, [dayId, placeId]);

	const result = [];

	for (const item of filteredBase) {
		let qty = item.default_quantity;

		const relatedDiffs = diffs.filter(d => d.item_id === item.item_id);

		for (const d of relatedDiffs) {
			if (d.action === 'set') qty = d.quantity;
			if (d.action === 'add') qty += d.quantity;
		}

		if (qty > 0) {
			result.push({
				item_id: item.item_id,
				name: item.name,
				qty
			});
		}
	}

	return result;
}

module.exports = { getFinalItemsForPlace };