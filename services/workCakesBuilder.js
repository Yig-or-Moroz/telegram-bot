const { all } = require('../core/db');
const { getTargetDateInfo } = require('../core/date');
const { getFinalItemsForPlace } = require('../core/diffEngine');

async function getWorkCakesDetailed(dayId) {

	const { targetDay } = getTargetDateInfo();

	// тільки заклади які працюють завтра
	const workingPlaces = await all(`
		SELECT id
		FROM places
		WHERE instr(',' || days_of_week || ',', ',' || ? || ',') > 0
	`, [targetDay]);

	const baseItems = await all(`
		SELECT DISTINCT i.id, i.name
		FROM place_items pi
		JOIN items i ON i.id = pi.item_id
	`);

	const result = [];

	for (const item of baseItems) {

		let normal = 0;

		// ---------- ЗВИЧАЙНІ ----------
		for (const p of workingPlaces) {
			const items = await getFinalItemsForPlace(dayId, p.id);
			const found = items.find(x => x.item_id === item.id);
			if (found) normal += found.qty;
		}

		// ---------- ЗАКАЗНІ (БЕЗ ДОСТАВКИ!) ----------
		const customsRaw = await all(`
			SELECT comment
			FROM day_items
			WHERE day_id = ?
				AND item_id = ?
				AND is_custom = 1
				AND place_id != 6
		`, [dayId, item.id]);

		const customsGrouped = {};

		for (const c of customsRaw) {
			const key = c.comment || 'без коментаря';
			customsGrouped[key] = (customsGrouped[key] || 0) + 1;
		}

		// ---------- ДОСТАВКА (з коментарями) ----------
		const deliveryRaw = await all(`
			SELECT comment
			FROM day_items
			WHERE day_id = ?
				AND item_id = ?
				AND is_custom = 1
				AND place_id = 6
		`, [dayId, item.id]);

		const deliveryGrouped = {};

		for (const d of deliveryRaw) {
			const key = d.comment || 'без коментаря';
			deliveryGrouped[key] = (deliveryGrouped[key] || 0) + 1;
		}

		if (normal || customsRaw.length || deliveryRaw.length) {
			result.push({
				name: item.name,
				normal,
				customsGrouped,
				deliveryGrouped
			});
		}
	}

	return result;
}

module.exports = { getWorkCakesDetailed };