require ('dotenv').config();
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
		['📄 Переглянути заявку'],
		['✏️ Редагувати заявку'],
		['🧩 Змінити шаблон'],   // 👈 нова кнопка
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
			AND is_custom = 0   -- ❗ КЛЮЧОВЕ
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
			continue; // ❗ дуже важливо
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

/* ---------------- START / VIEW ---------------- */

bot.start(async (ctx) => {
	const day = await getOrCreateTargetDay();
	ctx.reply(await buildRequestText(day.id, day.date), {
		...mainMenu(),
		parse_mode: 'HTML'
	});
});

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

	// ✅ Спеціальна логіка для Доставки
	if (place.name === 'Доставка') {
		const items = await all(`SELECT id, name FROM items ORDER BY name`);

		return ctx.editMessageText(
			'Оберіть позицію для доставки:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(i.name, `delivery_pick_${placeId}_${i.id}`)
				])
			)
		);
	}

	// звичайна логіка для інших
	ctx.editMessageText(
		'Що зробити?',
		Markup.inlineKeyboard([
			[Markup.button.callback('🔢 Змінити кількість', `edit_qty_menu_${placeId}`)],
			[Markup.button.callback('🧁 Додати заказний', `add_custom_${placeId}`)]
		])
	);
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
	const items = await getFinalItemsForPlace(day.id, placeId);

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

/* ---------------- HISTORY ---------------- */

bot.hears('🗂 Попередні заявки', async (ctx) => {
	const days = await all(`SELECT * FROM days ORDER BY date DESC LIMIT 10`);
	ctx.reply(
		'Оберіть дату:',
		Markup.inlineKeyboard(days.map(d => [Markup.button.callback(d.date, `view_day_${d.id}`)]))
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

		console.log('TPL EDIT QTY HIT'); // тепер побачиш

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
