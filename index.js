require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

bot.use((ctx, next) => {
	ctx.session = ctx.session || {};
	return next();
});

/* ---------------- DB ---------------- */

const run = (sql, p = []) =>
	new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

const get = (sql, p = []) =>
	new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));

const all = (sql, p = []) =>
	new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));

/* ---------------- DATE LOGIC ---------------- */

function getTargetDateInfo() {
	const today = new Date();
	const d = today.getDay();

	let target = new Date(today);

	if (d === 6) target.setDate(today.getDate() + 2); // субота
	else if (d === 0) target.setDate(today.getDate() + 1); // неділя
	else target.setDate(today.getDate() + 1);

	const targetDay = target.getDay() === 0 ? 7 : target.getDay();
	const targetDate = target.toISOString().split('T')[0];

	return { targetDate, targetDay };
}

async function getOrCreateTargetDay() {
	const { targetDate } = getTargetDateInfo();
	let day = await get(`SELECT * FROM days WHERE date = ?`, [targetDate]);
	if (day) return day;
	const r = await run(`INSERT INTO days (date) VALUES (?)`, [targetDate]);
	return { id: r.lastID, date: targetDate };
}

function formatDateUA(dateStr) {
	const [y, m, d] = dateStr.split('-');
	return `${d}.${m}.${y}`;
}

/* ---------------- MENU ---------------- */

const mainMenu = () =>
	Markup.keyboard([
		['🎂 Торти в роботі'],
		['📄 Переглянути заявку'],
		['✏️ Редагувати заявку'],
		['🧩 Змінити шаблон'], 
		['🗂 Попередні заявки']
	]).resize();

/* ---------------- DIFF ENGINE ---------------- */

async function getFinalItemsForPlace(dayId, placeId) {
	const base = await all(`
		SELECT i.id item_id, i.name, pi.default_quantity
		FROM place_items pi
		JOIN items i ON i.id = pi.item_id
		WHERE pi.place_id = ?
	`, [placeId]);

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
			if (d.action === 'set') {
				qty = d.quantity;
			}
			if (d.action === 'add') {
				qty += d.quantity;
			}
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

/* ---------------- GET WORK CACKES ---------------- */

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

/* ---------------- HELPERS ---------------- */

function esc(s = '') {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/* ---------------- VIEW TEXT ---------------- */

async function buildRequestText(dayId, date) {
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
		const items = await getFinalItemsForPlace(dayId, place.id);

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

/* ---------------- START ---------------- */

bot.start(async (ctx) => {
	const day = await getOrCreateTargetDay();
	ctx.reply(await buildRequestText(day.id, day.date), {
		...mainMenu(),
		parse_mode: 'HTML'
	});
});

/* ---------------- VIEW GET WORK CACKES ---------------- */

bot.hears('🎂 Торти в роботі', async (ctx) => {
	const day = await getOrCreateTargetDay();
	const cakes = await getWorkCakesDetailed(day.id);

	if (!cakes.length) {
		return ctx.reply('Немає тортів у роботі на цей день', mainMenu());
	}

	let text = `<i>Торти в роботі на ${formatDateUA(day.date)}</i>\n`;

	for (const c of cakes) {
		text += `\n\n<b>${esc(c.name)}</b>:\n`;

		if (c.normal) {
			text += `Звичайні — ${c.normal}\n`;
		}

		// ---------- Заказні ----------
		const customKeys = Object.keys(c.customsGrouped);
		if (customKeys.length) {
			text += `Заказні:\n`;
			for (const k of customKeys) {
				text += `      ${c.customsGrouped[k]} - ${esc(k)}\n`;
			}
		}

		// ---------- Доставка ----------
		const deliveryKeys = Object.keys(c.deliveryGrouped);
		if (deliveryKeys.length) {
			text += `Доставка:\n`;
			for (const k of deliveryKeys) {
				text += `      ${c.deliveryGrouped[k]} - ${esc(k)}\n`;
			}
		}
	}

	ctx.reply(text, { parse_mode: 'HTML', ...mainMenu() });
});

/* ---------------- VIEW APPLICATION ---------------- */

bot.hears('📄 Переглянути заявку', async (ctx) => {
	const day = await getOrCreateTargetDay();
	ctx.reply(await buildRequestText(day.id, day.date), {
		...mainMenu(),
		parse_mode: 'HTML'
	});
});

/* ---------------- EDIT FLOW ---------------- */

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


/* ---------------- CHANGE TEMPLATE ---------------- */

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

bot.action(/^tpl_qty_menu_(\d+)?/, async (ctx) => {
	const placeId = ctx.match[1];

	const items = await all(`
		SELECT pi.item_id, i.name, pi.default_quantity
		FROM place_items pi
		JOIN items i ON i.id = pi.item_id
		WHERE pi.place_id = ?
		ORDER BY i.name
	`, [placeId]);

	ctx.editMessageText(
		'Оберіть позицію:',
		Markup.inlineKeyboard(
			items.map(i => [
				Markup.button.callback(
					`${i.name} — ${i.default_quantity}`,
					`tpl_edit_qty_${placeId}_${i.item_id}`
				)
			])
		)
	);
});

bot.action(/^tpl_edit_qty_(\d+)_(\d+)?/, async (ctx) => {
	await ctx.answerCbQuery();

	ctx.session.state = 'tplEditQty';
	ctx.session.placeId = ctx.match[1];
	ctx.session.itemId = ctx.match[2];

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
	const exists = await get(`
		SELECT 1 FROM place_items
		WHERE place_id = ? AND item_id = ?
	`, [placeId, itemId]);

	if (exists) {
		return ctx.answerCbQuery('Вже є в шаблоні ❌', { show_alert: true });
	}

	if (placeId == '6') {
			await run(`
		INSERT INTO place_items (place_id, item_id, default_quantity)
		VALUES (?, ?, 0)
	`, [placeId, itemId]);
	} else {
		await run(`
		INSERT INTO place_items (place_id, item_id, default_quantity)
		VALUES (?, ?, 1)
	`, [placeId, itemId]);
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



/* ---------------- HISTORY ---------------- */

bot.hears('🗂 Попередні заявки', async (ctx) => {
	const days = await all(`
		SELECT id, date
		FROM days
		ORDER BY date DESC
	`);

	if (!days.length) {
		return ctx.reply('Історія ще порожня');
	}

	ctx.reply(
		'Оберіть дату:',
		Markup.inlineKeyboard(
			days.map(d => [
				Markup.button.callback(
					formatDateUA(d.date),
					`view_day_${d.id}`
				)
			])
		)
	);
});

bot.action(/^view_day_(\d+)?/, async (ctx) => {
	const day = await get(`SELECT * FROM days WHERE id = ?`, [ctx.match[1]]);
	ctx.editMessageText(await buildRequestText(day.id, day.date), { parse_mode: 'HTML' });
});

// --------------BOT ON ----------------------

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
			WHERE place_id = ? AND item_id = ?
		`, [qty, placeId, itemId]);

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

/* ---------------- START ---------------- */

bot.launch();
console.log('Bot started');
