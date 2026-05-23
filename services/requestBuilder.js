const { all } = require('../core/db');
const { formatDateUA } = require('../core/date');
const { getFinalItemsForPlace } = require('../core/diffEngine');
const { esc } = require('../core/helpers');


async function buildRequestText(dayId, date, mode = 'normal') {
	const jsDay = new Date(date).getDay();
	const dbDay = jsDay === 0 ? 7 : jsDay;

	const places = await all(`
		SELECT id, name
		FROM places
		WHERE instr(',' || days_of_week || ',', ',' || ? || ',') > 0
		ORDER BY id
	`, [dbDay]);

	let text = `<i>Заявка на ${formatDateUA(date)} р.</i>\n`;

	for (const place of places) {
		const isPrepView = place.name.includes('Заготовки');

		const items = await getFinalItemsForPlace(dayId, place.id, {
			excludeNoPreparation: mode === 'preparation'
		});

		const customs = await all(`
		SELECT di.quantity, di.comment, i.name
		FROM day_items di
		JOIN items i ON i.id = di.item_id
		WHERE di.day_id = ?
		AND di.place_id = ?
		AND di.is_custom = 1
	`, [dayId, place.id]);

		if (items.length === 0 && customs.length === 0) continue;

		text += `\n\n<b><u>${esc(place.name)}</u></b>\n`;

		// ✅ СПЕЦ ЛОГІКА ДЛЯ ДОСТАВКИ (ПЕРШОЮ!)
		if (place.name === 'Доставка') {
			for (const c of customs) {
				text += `• ${c.name} — 1`;
				if (c.comment) text += ` (${c.comment})`;
				text += '\n';
			}
			continue; 
		}

		// --- ЗВИЧАЙНА ЛОГІКА ДЛЯ ІНШИХ ЗАКЛАДІВ ---

		for (const i of items) {
			text += `• ${i.name} — ${i.qty}\n`;
		}

		if (customs.length) {
			text += `___________________________\n`;
			text += `<u>Заказні</u>\n`;
			for (const c of customs) {
				text += `• ${c.name} — ${c.quantity}`;
				if (c.comment) text += ` (${c.comment})`;
				text += '\n';
			}
		}
	}

	return text;
}

module.exports = { buildRequestText };