const { get, all, run } = require('../core/db');
const { getOrCreateDayByDate } = require('../core/date');
const { getFinalItemsForPlace } = require('../core/diffEngine');
const mainMenu = require('../keyboards/mainMenu');

module.exports = (bot) => {	
	
	bot.on('text', async (ctx) => {
		const state = ctx.session.state;
		if (!state) return;

		const text = ctx.message.text.trim();

		/* ---------- ADMIN ADD PLACE ---------- */
		if (state === 'adminAddPlace') {
			const name = text.trim();

			if (!name) return ctx.reply('Назва не може бути пустою');

			await run(`
				INSERT INTO places (name, days_of_week)
				VALUES (?, '1,2,3,4,5,6,7')
			`, [name]);

			ctx.session.state = null;
			return ctx.reply('✅ Заклад додано', mainMenu());
		}

		/* ---------- TEMPLATE QTY ---------- */
		if (state === 'tplEditQty') {

			const { placeId, itemId } = ctx.session;

			const qty = parseInt(text);
			if (isNaN(qty)) return ctx.reply('Потрібно число');

			await run(`
				UPDATE place_items
				SET default_quantity = ?
				WHERE place_id = ?
				AND item_id = ?
				AND weekday = ?
			`, [
				qty,
				ctx.session.placeId,
				ctx.session.itemId,
				ctx.session.weekday
			]);

			await run(`
				DELETE FROM day_items
				WHERE place_id = ?
					AND item_id = ?
					AND action = 'set'
					AND is_custom = 0
			`, [placeId, itemId]);

			ctx.session.state = null;
			return ctx.reply('✅ Шаблон оновлено', mainMenu());
		}

		/* ---------- TEMPLATE ADD ---------- */

		if (state === 'tplCreateItem') {
			const { placeId } = ctx.session;
			const name = text.trim();

			if (!name) return ctx.reply('Назва не може бути пустою');

			// перевірка дубля
			const existing = await get(`
			SELECT id FROM items WHERE LOWER(name) = LOWER(?)
		`, [name]);

			let itemId;

			if (existing) {
				itemId = existing.id;

				return ctx.reply('Така позиція вже є в існуючих!');
			} else {
				const res = await run(`
				INSERT INTO items (name)
				VALUES (?)
			`, [name]);

				itemId = res.lastID;
			}

			// додаємо в шаблон (якщо нема)
			const existsInTemplate = await get(`
				SELECT 1 FROM place_items
				WHERE place_id = ? AND item_id = ?
			`, [placeId, itemId]);

				if (!existsInTemplate) {
					const place = await get(`SELECT days_of_week FROM places WHERE id = ?`, [placeId]);
					const days = [1,2,3,4,5,6,7];

					for (const d of days) {
						await run(`
							INSERT INTO place_items (place_id, item_id, default_quantity, weekday)
							VALUES (?, ?, 1, ?)
						`, [placeId, itemId, d]);
					}
				}

			ctx.session.state = null;

			return ctx.reply('✅ Позицію додано в шаблон', mainMenu());
		}

		/* ---------- TEMPLATE DAYS ---------- */
		if (state === 'tplEditDays') {
			const { placeId } = ctx.session;

			// чистимо пробіли
			const raw = text.replace(/\s/g, '');

			// перевірка формату
			if (!/^[1-7](,[1-7])*$/.test(raw)) {
				return ctx.reply(
					'❌ Невірний формат.\nПриклад правильного: 1,2,6,7'
				);
			}

			// нормалізуємо (прибрати дублікати і відсортувати)
			const days = [...new Set(raw.split(','))]
				.map(Number)
				.sort((a, b) => a - b)
				.join(',');

			await run(`
				UPDATE places
				SET days_of_week = ?
				WHERE id = ?
			`, [days, placeId]);

			ctx.session.state = null;

			return ctx.reply('✅ Шаблон змінено', mainMenu());
		}


		/* ---------- EDIT QTY ---------- */
		if (state === 'editQty') {
			const { placeId, itemId, editDate } = ctx.session;

			const day = await getOrCreateDayByDate(editDate);

			const qty = parseInt(text);
			if (isNaN(qty)) return ctx.reply('Потрібно число');

			await run(`
				INSERT INTO day_items (day_id, place_id, item_id, action, quantity)
				VALUES (?, ?, ?, 'set', ?)
			`, [day.id, placeId, itemId, qty]);

			ctx.session.state = null;
			ctx.session.editDate = null;

			return ctx.reply('✅ Оновлено', mainMenu());
		}

		/* ---------- DELIVERY AND CUSTOM COMMENT---------- */
		if (state === 'customComment') {
			const { customPlaceId, itemId, customDate } = ctx.session;

			const comment = (text.toLowerCase() === 'ні' || text === '') ? '' : text;

			const day = await getOrCreateDayByDate(customDate);

			await run(`
				INSERT INTO day_items
				(day_id, place_id, item_id, action, quantity, comment, is_custom)
				VALUES (?, ?, ?, 'add', 1, ?, 1)
			`, [day.id, customPlaceId, itemId, comment]);

			ctx.session.state = null;
			ctx.session.customPlaceId = null;
			ctx.session.customDate = null;

			return ctx.reply('✅ Заказний додано', mainMenu());
		}

		if (state === 'deliveryComment') {
			const { itemId, deliveryDate } = ctx.session;
			const comment = (text.toLowerCase() === 'ні' || text === '') ? '' : text;

			const day = await getOrCreateDayByDate(deliveryDate);

			await run(`
				INSERT INTO day_items
				(day_id, place_id, item_id, action, quantity, comment, is_custom)
				VALUES (?, 6, ?, 'add', 1, ?, 1)
			`, [day.id, itemId, comment]);

			ctx.session.state = null;
			ctx.session.deliveryDate = null;

			return ctx.reply('✅ Додано', mainMenu());
		}

		if (ctx.session.state === 'deliveryComment') {
			const comment = ctx.message.text.toLowerCase() === 'ні'
				? ''
				: ctx.message.text;

			const day = await getOrCreateDayByDate(ctx.session.deliveryDate);

			await run(`
				INSERT INTO day_items
					(day_id, place_id, item_id, qty, is_custom, comment)
				VALUES (?, 6, ?, 1, 1, ?)
			`, [day.id, ctx.session.itemId, comment]);

			ctx.session.state = null;

			return ctx.reply('✅ Додано');
		}
	});
}