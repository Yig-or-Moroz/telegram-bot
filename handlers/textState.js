const { get, all, run } = require('../core/db');
const { getOrCreateTargetDay, getTargetDateInfo } = require('../core/date');
const { getFinalItemsForPlace } = require('../core/diffEngine');
//const { Markup } = require('telegraf');
const mainMenu = require('../keyboards/mainMenu');

module.exports = (bot) => {	
	
	bot.on('text', async (ctx) => {
		const state = ctx.session.state;
		if (!state) return;

		const text = ctx.message.text.trim();
		const day = await getOrCreateTargetDay();

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
				await run(`
				INSERT INTO place_items (place_id, item_id, default_quantity)
				VALUES (?, ?, 1)
			`, [placeId, itemId]);
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
			const { placeId, itemId } = ctx.session;

			const qty = parseInt(text);
			if (isNaN(qty)) return ctx.reply('Потрібно число');

			await run(`
				INSERT INTO day_items (day_id, place_id, item_id, action, quantity)
				VALUES (?, ?, ?, 'set', ?)
			`, [day.id, placeId, itemId, qty]);

			ctx.session.state = null;
			return ctx.reply('✅ Оновлено', mainMenu());
		}

		/* ---------- DELIVERY ---------- */
		if (state === 'deliveryComment' || state === 'customComment') {
			const { placeId, itemId } = ctx.session;
			const comment = (text.toLowerCase() === 'ні' || text === '') ? '' : text;

			await run(`
				INSERT INTO day_items
				(day_id, place_id, item_id, action, quantity, comment, is_custom)
				VALUES (?, ?, ?, 'add', 1, ?, 1)
			`, [day.id, placeId, itemId, comment]);

			ctx.session.state = null;
			return ctx.reply('✅ Додано', mainMenu());
		}
	});
}