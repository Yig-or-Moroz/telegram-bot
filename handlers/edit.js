const { get, all, run } = require('../core/db');
const { getOrCreateTargetDay, getTargetDateInfo } = require('../core/date');
const { getFinalItemsForPlace } = require('../core/diffEngine');
const { Markup } = require('telegraf');
const mainMenu = require('../keyboards/mainMenu');

module.exports = (bot) => {
	
	bot.hears('✏️ Редагувати заявку', async (ctx) => {
		const { targetDay } = getTargetDateInfo();

		const places = await all(`
			SELECT id, name
			FROM places
			WHERE instr(',' || days_of_week || ',', ',' || ? || ',') > 0
			ORDER BY id
		`, [targetDay]);

		ctx.reply(
			'Оберіть заклад:',
			Markup.inlineKeyboard(
				places.map(p => [
					Markup.button.callback(p.name, `edit_place_${p.id}`)
				])
			)
		);
	});

	bot.action(/^edit_place_(\d+)?/, async (ctx) => {
		const placeId = ctx.match[1];

		const place = await get(`SELECT name FROM places WHERE id = ?`, [placeId]);

		// ✅ НОВА логіка для Доставки
		if (place.name === 'Доставка') {
			const day = await getOrCreateTargetDay();

			const hasDelivery = await get(`
				SELECT 1
				FROM day_items
				WHERE day_id = ?
				AND place_id = ?
				AND is_custom = 1
				LIMIT 1
		`, [day.id, placeId]);

			// якщо ще нема доставок — одразу на додавання
			if (!hasDelivery) {

				// беремо позиції з ШАБЛОНУ Доставки (place_id = 6)
				const items = await all(`
					SELECT i.id as item_id, i.name
					FROM place_items pi
					JOIN items i ON i.id = pi.item_id
					WHERE pi.place_id = 6
						AND pi.weekday = 7
					ORDER BY i.name
				`);

				return ctx.editMessageText(
					'Оберіть позицію для доставки:',
					Markup.inlineKeyboard(
						items.map(i => [
							Markup.button.callback(
								i.name,
								`delivery_pick_${placeId}_${i.item_id}`
							)
						])
					)
				);
			}

			// якщо вже є — показуємо меню
			return ctx.editMessageText(
				'Що зробити з доставкою?',
				Markup.inlineKeyboard([
					[Markup.button.callback('➕ Додати доставку', `delivery_add_menu_${placeId}`)],
					[Markup.button.callback('❌ Видалити з доставки', `delivery_remove_menu_${placeId}`)],
				])
			);
		}

		// звичайна логіка для інших
		const day = await getOrCreateTargetDay();

		const hasCustoms = await get(`
			SELECT 1
			FROM day_items
			WHERE day_id = ?
			AND place_id = ?
			AND is_custom = 1
			LIMIT 1
	`, [day.id, placeId]);

		const buttons = [
			[Markup.button.callback('🔢 Змінити кількість', `edit_qty_menu_${placeId}`)],
			[Markup.button.callback('🧁 Додати заказний', `add_custom_${placeId}`)]
		];

		if (hasCustoms) {
			buttons.push([
				Markup.button.callback('❌ Видалити заказний', `remove_custom_${placeId}`)
			]);
		}

		ctx.editMessageText(
			'Що зробити?',
			Markup.inlineKeyboard(buttons)
		);
	});

	bot.action(/^delivery_add_menu_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];
		const day = await getOrCreateTargetDay();

		const items = await all(`
			SELECT i.id as item_id, i.name
			FROM place_items pi
			JOIN items i ON i.id = pi.item_id
			WHERE pi.place_id = 6
			ORDER BY i.name
		`);

		ctx.editMessageText(
			'Оберіть позицію для доставки:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(
						i.name,
						`delivery_pick_${placeId}_${i.item_id}`
					)
				])
			)
		);
	});

	bot.action(/^delivery_remove_menu_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];
		const day = await getOrCreateTargetDay();

		const deliveries = await all(`
			SELECT di.id, di.comment, i.name
			FROM day_items di
			JOIN items i ON i.id = di.item_id
			WHERE di.day_id = ?
				AND di.place_id = ?
				AND di.is_custom = 1
		`, [day.id, placeId]);

		if (!deliveries.length) {
			return ctx.editMessageText('Немає доставок для видалення');
		}

		ctx.editMessageText(
			'Оберіть позицію для видалення з доставки:',
			Markup.inlineKeyboard(
				deliveries.map(d => [
					Markup.button.callback(
						`${d.name}${d.comment ? ' (' + d.comment + ')' : ''}`,
						`delivery_confirm_remove_${d.id}`
					)
				])
			)
		);
	});

	bot.action(/^delivery_confirm_remove_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		const id = ctx.match[1];

		await run(`
			DELETE FROM day_items
			WHERE id = ?
		`, [id]);

		ctx.editMessageText('✅ Позицію видалено з доставки');
	});

	/* ----- CHANGE QTY ----- */

	bot.action(/^edit_qty_menu_(\d+)?/, async (ctx) => {
		const placeId = ctx.match[1];
		const day = await getOrCreateTargetDay();
		const items = await getFinalItemsForPlace(day.id, placeId);

		ctx.editMessageText(
			'Оберіть позицію:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(`${i.name} — ${i.qty}`, `edit_qty_${placeId}_${i.item_id}`)
				])
			)
		);
	});

	bot.action(/^edit_qty_(\d+)_(\d+)?/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'editQty';
		ctx.session.placeId = ctx.match[1];
		ctx.session.itemId = ctx.match[2];

		await ctx.reply('Введіть нову кількість:');
	});

	/* ----- CUSTOM ITEM ----- */

	bot.action(/^add_custom_(\d+)?/, async (ctx) => {
		const placeId = ctx.match[1];
		const day = await getOrCreateTargetDay();
		const items = await all(`
			SELECT i.id as item_id, i.name
			FROM place_items pi
			JOIN items i ON i.id = pi.item_id
			WHERE pi.place_id = 6
				AND pi.weekday = 7
			ORDER BY i.name
		`);

		ctx.editMessageText(
			'Оберіть позицію для заказного:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(
						i.name,
						`custom_pick_${placeId}_${i.item_id}`
					)
				])
			)
		);
	});

	bot.action(/^remove_custom_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		const placeId = ctx.match[1];
		const day = await getOrCreateTargetDay();

		const customs = await all(`
			SELECT di.id, di.comment, i.name
			FROM day_items di
			JOIN items i ON i.id = di.item_id
			WHERE di.day_id = ?
				AND di.place_id = ?
				AND di.is_custom = 1
		`, [day.id, placeId]);

		if (!customs.length) {
			return ctx.editMessageText('Немає заказних для видалення');
		}

		ctx.editMessageText(
			'Оберіть заказний для видалення:',
			Markup.inlineKeyboard(
				customs.map(c => [
					Markup.button.callback(
						`${c.name}${c.comment ? ' (' + c.comment + ')' : ''}`,
						`confirm_remove_custom_${c.id}`
					)
				])
			)
		);
	});

	bot.action(/^confirm_remove_custom_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		const id = ctx.match[1];

		await run(`
			DELETE FROM day_items
			WHERE id = ?
		`, [id]);

		ctx.editMessageText('✅ Заказний видалено');
	});

	bot.action(/^custom_pick_(\d+)_(\d+)?/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'customComment';
		ctx.session.placeId = ctx.match[1];
		ctx.session.itemId = ctx.match[2];

		await ctx.reply('Введіть коментар (або "ні"):');
	});

	/* ---------- DELIVERY ITEM ----------- */

	bot.action(/^delivery_pick_(\d+)_(\d+)?/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'deliveryComment';
		ctx.session.placeId = ctx.match[1];
		ctx.session.itemId = ctx.match[2];

		await ctx.reply('Введіть коментар (або "ні"):');
	});
}