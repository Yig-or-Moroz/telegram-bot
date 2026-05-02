const { get, all, run } = require('../core/db');
const { Markup } = require('telegraf');

module.exports = (bot) => {
	
	bot.hears('🧩 Змінити шаблон', async (ctx) => {
		const places = await all(`SELECT id, name FROM places ORDER BY id`);

		ctx.reply(
			'Оберіть заклад для редагування шаблону:',
			Markup.inlineKeyboard(
				places.map(p => [
					Markup.button.callback(p.name, `tpl_place_${p.id}`)
				])
			)
		);
	});


	bot.action(/^tpl_place_(\d+)?/, async (ctx) => {
		const placeId = ctx.match[1];

		ctx.editMessageText(
			'Що змінити у шаблоні?',
			Markup.inlineKeyboard([
				[Markup.button.callback('🔢 Змінити кількість', `tpl_qty_menu_${placeId}`)],
				[Markup.button.callback('➕ Додати позицію', `tpl_add_item_${placeId}`)],
				[Markup.button.callback('❌ Видалити позицію', `tpl_remove_item_${placeId}`)],
				[Markup.button.callback('📅 Змінити дні тижня', `tpl_days_${placeId}`)]
			])
		);
	});


	bot.action(/^tpl_qty_menu_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		const place = await get(`SELECT days_of_week, name FROM places WHERE id = ?`, [placeId]);
		const days = place.days_of_week.split(',').map(d => d.trim());

		const dayNames = {
			1: 'Понеділок',
			2: 'Вівторок',
			3: 'Середа',
			4: 'Четвер',
			5: 'Пʼятниця',
			6: 'Субота',
			7: 'Неділя'
		};

		await ctx.editMessageText(
			`Оберіть день для шаблону закладу "${place.name}":`,
			Markup.inlineKeyboard(
				days.map(d => [
					Markup.button.callback(
						dayNames[d],
						`tpl_qty_day_${placeId}_${d}`
					)
				])
			)
		);
	});


	bot.action(/^tpl_qty_day_(\d+)_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];
		const weekday = ctx.match[2];

		const items = await all(`
			SELECT pi.item_id, i.name, pi.default_quantity
			FROM place_items pi
			JOIN items i ON i.id = pi.item_id
			WHERE pi.place_id = ?
			AND pi.weekday = ?
			ORDER BY i.name
		`, [placeId, weekday]);

		if (!items.length) {
			return ctx.editMessageText('На цей день шаблон ще порожній.');
		}

		await ctx.editMessageText(
			'Оберіть позицію:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(
						`${i.name} — ${i.default_quantity}`,
						`tpl_edit_qty_${placeId}_${i.item_id}_${weekday}`
					)
				])
			)
		);
	});

	bot.action(/^tpl_edit_qty_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'tplEditQty';
		ctx.session.placeId = ctx.match[1];
		ctx.session.itemId = ctx.match[2];
		ctx.session.weekday = ctx.match[3];

		await ctx.reply('Введіть нову кількість:');
	});


	bot.action(/^tpl_add_item_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		ctx.session.placeId = placeId;

		return ctx.editMessageText(
			'Що ви хочете зробити?',
			Markup.inlineKeyboard([
				[Markup.button.callback('➕ Додати існуючу позицію', `tpl_add_existing_${placeId}`)],
				[Markup.button.callback('🆕 Створити нову позицію', `tpl_add_new_${placeId}`)],
			])
		);
	});


	bot.action(/^tpl_add_existing_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		const items = await all(`SELECT id, name FROM items ORDER BY name`);

		ctx.session.placeId = placeId;

		return ctx.editMessageText(
			'Оберіть позицію для додавання:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(i.name, `tpl_add_pick_${placeId}_${i.id}`)
				])
			)
		);
	});


	bot.action(/^tpl_add_pick_(\d+)_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];
		const itemId = ctx.match[2];

		// перевірка дублю
		const place = await get(`SELECT days_of_week FROM places WHERE id = ?`, [placeId]);
		const days = [1,2,3,4,5,6,7];

		for (const d of days) {
			const exists = await get(`
				SELECT 1 FROM place_items
				WHERE place_id = ? AND item_id = ? AND weekday = ?
			`, [placeId, itemId, d]);

			if (!exists) {
				await run(`
					INSERT INTO place_items (place_id, item_id, weekday, default_quantity)
					VALUES (?, ?, ?, ?)
				`, [
					placeId,
					itemId,
					d,
					placeId == '6' ? 0 : 1
				]);
			}
		}

		await ctx.answerCbQuery();

		return ctx.editMessageText('✅ Позицію додано в шаблон');
	});


	bot.action(/^tpl_add_new_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		ctx.session.state = 'tplCreateItem';
		ctx.session.placeId = placeId;

		await ctx.reply('Введіть назву нової позиції:');
	});


	bot.action(/^tpl_remove_item_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		const items = await all(`
			SELECT DISTINCT i.id, i.name
			FROM place_items pi
			JOIN items i ON i.id = pi.item_id
			WHERE pi.place_id = ?
			ORDER BY i.name
		`, [placeId]);

		if (!items.length) {
			return ctx.editMessageText('У шаблоні немає позицій');
		}

		ctx.editMessageText(
			'Оберіть позицію для видалення з шаблонів ВСІХ закладів:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(
						i.name,
						`tpl_confirm_remove_${i.id}`
					)
				])
			)
		);
	});


	bot.action(/^tpl_confirm_remove_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		const itemId = ctx.match[1];

		// Видаляємо з шаблонів усіх закладів
		await run(`
			DELETE FROM place_items
			WHERE item_id = ?
		`, [itemId]);

		// Видаляємо можливі diff-и, щоб не лишалось сміття
		await run(`
			DELETE FROM day_items
			WHERE item_id = ?
				AND is_custom = 0
		`, [itemId]);

		ctx.editMessageText('✅ Позицію видалено з шаблонів усіх закладів');
	});


	bot.action(/^tpl_days_(\d+)$/, async (ctx) => {
		await ctx.answerCbQuery();

		ctx.session.state = 'tplEditDays';
		ctx.session.placeId = ctx.match[1];

		await ctx.reply(
			'Введіть дні тижня через кому.\n\nНаприклад: 1,2,6,7\n\n(1 — Пн ... 7 — Нд)'
		);
	});
}