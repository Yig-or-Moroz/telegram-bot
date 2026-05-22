const { Markup } = require('telegraf');
const { get, all, run } = require('../core/db');
const {
	formatDateUA,
	getShiftedDate,
	getOrCreateDayByDate,
	getDbDayFromDate
} = require('../core/date');
const { getFinalItemsForPlace } = require('../core/diffEngine');
const { showDeliveryTemplate } = require('../services/deliveryTemplate');
const mainMenu = require('../keyboards/mainMenu');


module.exports = (bot) => {

	bot.hears('✏️ Редагувати заявку', async (ctx) => {

		ctx.session.state = null;

		const today = getShiftedDate(0);
		const tomorrow = getShiftedDate(1);
		const afterTomorrow = getShiftedDate(2);

		await ctx.reply(
			'Оберіть заявку:',
			Markup.inlineKeyboard([
				[Markup.button.callback(`🗳 Вивоз на ${formatDateUA(today)}`, `edit_date_${today}`)],
				[Markup.button.callback(`🎂 Заявка на ${formatDateUA(tomorrow)}`, `edit_date_${tomorrow}`)],
				[Markup.button.callback(`🥞 Заготовки на ${formatDateUA(afterTomorrow)}`, `edit_date_${afterTomorrow}`)],
				[Markup.button.callback(`📝 Заказні`, `edit_custom_places`)],
				[Markup.button.callback(`🚚 Доставка`, `edit_delivery_dates`)]
				
			])
		);
	});


	bot.action(/edit_date_([^_]+)/, async (ctx) => {
		const date = ctx.match[1];
		const dbDay = getDbDayFromDate(date);

		const places = await all(`
			SELECT id, name
			FROM places
			WHERE name != 'Доставка'
			AND instr(',' || days_of_week || ',', ',' || ? || ',') > 0
			ORDER BY id
		`, [dbDay]);

		await ctx.editMessageText(
			`Заклади на ${formatDateUA(date)}:`,
			Markup.inlineKeyboard(
				places.map(p => [
					Markup.button.callback(p.name, `edit_place_${date}_${p.id}`)
				])
			)
		);
	});

	bot.action(/edit_place_([^_]+)_(\d+)/, async (ctx) => {
		const date = ctx.match[1];
		const placeId = ctx.match[2];

		const day = await getOrCreateDayByDate(date);
		const items = await getFinalItemsForPlace(day.id, placeId);

		await ctx.editMessageText(
			'Оберіть позицію кількість якої потрібно змінити:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(
						`${i.name} — ${i.qty}`,
						`edit_qty_${date}_${placeId}_${i.item_id}`
					)
				])
			)
		);
	});

	bot.action(/^edit_qty_(\d{4}-\d{2}-\d{2})_(\d+)_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'editQty';
		ctx.session.editDate = ctx.match[1];
		ctx.session.placeId = ctx.match[2];
		ctx.session.itemId = ctx.match[3];

		await ctx.reply('Введіть нову кількість:');
	});

// -------------------DELIVERY---------------------

	bot.action('edit_delivery_dates', async (ctx) => {
		const buttons = [];

		for (let i = 1; i <= 7; i++) {
			const d = getShiftedDate(i);
			buttons.push([
				Markup.button.callback(
					formatDateUA(d),
					`delivery_date_${d}`
				)
			]);
		}

		await ctx.editMessageText(
			'Оберіть дату доставки:',
			Markup.inlineKeyboard(buttons)
		);
	});

	bot.action(/delivery_date_([^_]+)/, async (ctx) => {
		const date = ctx.match[1];
		const day = await getOrCreateDayByDate(date);

		const exists = await get(`
			SELECT 1
			FROM day_items
			WHERE day_id = ?
				AND place_id = 6
				AND is_custom = 1
			LIMIT 1
		`, [day.id]);

		if (!exists) {
			// ще немає доставки — одразу показуємо шаблон
			return showDeliveryTemplate(ctx, date);
		}

		// якщо вже є — показуємо меню
		await ctx.editMessageText(
			`Доставка на ${formatDateUA(date)}:`,
			Markup.inlineKeyboard([
				[Markup.button.callback('➕ Додати доставку', `delivery_add_${date}`)],
				[Markup.button.callback('❌ Видалити доставку', `delivery_remove_${date}`)]
			])
		);
	});

	bot.action(/delivery_pick_([^_]+)_(\d+)/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'deliveryComment';
		ctx.session.deliveryDate = ctx.match[1];
		ctx.session.itemId = ctx.match[2];

		await ctx.reply('Введіть коментар (або "ні"):');
	});

	bot.action(/delivery_add_([^_]+)/, async (ctx) => {
		const date = ctx.match[1];
		return showDeliveryTemplate(ctx, date);
	});

	bot.action(/delivery_remove_([^_]+)/, async (ctx) => {
		const date = ctx.match[1];
		const day = await getOrCreateDayByDate(date);

		const deliveries = await all(`
			SELECT di.id, i.name, di.comment
			FROM day_items di
			JOIN items i ON i.id = di.item_id
			WHERE di.day_id = ?
				AND di.place_id = 6
				AND di.is_custom = 1
			ORDER BY i.name
		`, [day.id]);

		if (!deliveries.length) {
			return ctx.answerCbQuery('Немає доставок на цю дату');
		}

		await ctx.editMessageText(
			'Оберіть доставку для видалення:',
			Markup.inlineKeyboard(
				deliveries.map(d => [
					Markup.button.callback(
						`${d.name} — ${d.comment || 'без коментаря'}`,
						`delivery_delete_${d.id}_${date}`
					)
				])
			)
		);
	});


	bot.action(/delivery_delete_(\d+)_([^_]+)/, async (ctx) => {
		const id = ctx.match[1];
		const date = ctx.match[2];

		await run(`DELETE FROM day_items WHERE id = ?`, [id]);

		await ctx.answerCbQuery('Видалено ✅');

		return ctx.reply('✅ Позицію видалено з доставки', mainMenu());

	});

// ------------------CUSTOM-------------------------

	bot.action('edit_custom_places', async (ctx) => {
		const places = await all(`
			SELECT id, name
			FROM places
			WHERE name != 'Доставка'
			ORDER BY name
		`);

		await ctx.editMessageText(
			'Оберіть заклад для заказного:',
			Markup.inlineKeyboard(
				places.map(p => [
					Markup.button.callback(p.name, `custom_place_${p.id}`)
				])
			)
		);
	});

	bot.action(/custom_place_(\d+)/, async (ctx) => {
		const placeId = ctx.match[1];

		const place = await get(`
			SELECT name, days_of_week
			FROM places
			WHERE id = ?
		`, [placeId]);

		const workingDays = place.days_of_week.split(',').map(Number);

		const buttons = [];

		for (let i = 1; i <= 10; i++) {
			const d = getShiftedDate(i);
			const dbDay = getDbDayFromDate(d);

			if (workingDays.includes(dbDay)) {
				buttons.push([
					Markup.button.callback(
						formatDateUA(d),
						`custom_date_${placeId}_${d}`
					)
				]);
			}
		}

		await ctx.editMessageText(
			`Дати роботи закладу "${place.name}":`,
			Markup.inlineKeyboard(buttons)
		);
	});

	bot.action(/custom_date_(\d+)_([^_]+)/, async (ctx) => {
		const placeId = ctx.match[1];
		const date = ctx.match[2];

		const day = await getOrCreateDayByDate(date);

		const exists = await get(`
			SELECT 1
			FROM day_items
			WHERE day_id = ?
				AND place_id = ?
				AND is_custom = 1
			LIMIT 1
		`, [day.id, placeId]);

		if (!exists) {
			ctx.session.customPlaceId = placeId;
			ctx.session.customDate = date;
			return showDeliveryTemplate(ctx, date, 'custom');
		}

		await ctx.editMessageText(
			`Заказні на ${formatDateUA(date)}:`,
			Markup.inlineKeyboard([
				[Markup.button.callback('➕ Додати заказний', `custom_add_${placeId}_${date}`)],
				[Markup.button.callback('❌ Видалити заказний', `custom_remove_${placeId}_${date}`)]
			])
		);
	});

	bot.action(/custom_pick_([^_]+)_(\d+)/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'customComment';
		ctx.session.itemId = ctx.match[2];

		await ctx.reply('Введіть коментар (або "ні"):');
	});

	bot.action(/custom_add_(\d+)_([^_]+)/, async (ctx) => {
		const placeId = ctx.match[1];
		const date = ctx.match[2];

		ctx.session.customPlaceId = placeId;
		ctx.session.customDate = date;

		return showDeliveryTemplate(ctx, date, 'custom');
	});

	bot.action(/custom_remove_(\d+)_([^_]+)/, async (ctx) => {
		const placeId = ctx.match[1];
		const date = ctx.match[2];

		const day = await getOrCreateDayByDate(date);

		const customs = await all(`
			SELECT di.id, i.name, di.comment
			FROM day_items di
			JOIN items i ON i.id = di.item_id
			WHERE di.day_id = ?
				AND di.place_id = ?
				AND di.is_custom = 1
			ORDER BY i.name
		`, [day.id, placeId]);

		if (!customs.length) {
			return ctx.answerCbQuery('Немає заказних на цю дату');
		}

		await ctx.editMessageText(
			'Оберіть заказний для видалення:',
			Markup.inlineKeyboard(
				customs.map(c => [
					Markup.button.callback(
						`${c.name} — ${c.comment || 'без коментаря'}`,
						`custom_delete_${c.id}_${placeId}_${date}`
					)
				])
			)
		);
	});

	bot.action(/custom_delete_(\d+)_(\d+)_([^_]+)/, async (ctx) => {
		const id = ctx.match[1];

		await run(`DELETE FROM day_items WHERE id = ?`, [id]);

		await ctx.answerCbQuery('Видалено ✅');

		return ctx.reply('✅ Заказний видалено', mainMenu());
	});
}

