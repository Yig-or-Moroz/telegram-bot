const { all, get } = require('./db');

async function getFinalItemsForPlace(dayId, placeId) {
	// 🔹 Дізнаємось дату і день тижня
	const day = await get(`
		SELECT date FROM days WHERE id = ?
	`, [dayId]);

	const jsDay = new Date(day.date).getDay();
	const dbDay = jsDay === 0 ? 7 : jsDay;

	// 🔹 Беремо шаблон ТІЛЬКИ для цього weekday
	const base = await all(`
		SELECT i.id AS item_id, i.name, pi.default_quantity
		FROM place_items pi
		JOIN items i ON i.id = pi.item_id
		WHERE pi.place_id = ?
			AND pi.weekday = ?
	`, [placeId, dbDay]);

	// 🔹 Всі дифи на цей день
	const diffs = await all(`
		SELECT * FROM day_items
		WHERE day_id = ? 
			AND place_id = ?
			AND is_custom = 0 
	`, [dayId, placeId]);

	const result = [];

	for (const item of base) {
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