const { Markup } = require('telegraf');
const { all } = require('../core/db');


async function showDeliveryTemplate(ctx, date, mode = 'delivery') {
	const items = await all(`
		SELECT DISTINCT i.id as item_id, i.name
		FROM place_items pi
		JOIN items i ON i.id = pi.item_id
		WHERE pi.place_id = 6
		ORDER BY i.name
	`);

	const prefix = mode === 'custom'
	? 'custom_pick'
	: 'delivery_pick';

	await ctx.editMessageText(
		'Оберіть позицію для доставки:',
		Markup.inlineKeyboard(
			items.map(i => [
				Markup.button.callback(
					i.name,
					`${prefix}_${date}_${i.item_id}`
				)
			])
		)
	);
}

module.exports = { showDeliveryTemplate };