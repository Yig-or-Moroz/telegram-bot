require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session());

bot.use((ctx, next) => {
	ctx.session = ctx.session || {};
	return next();
});

/* -------------------- HELPERS -------------------- */

function run(sql, params = []) {
	return new Promise((res, rej) => {
		db.run(sql, params, function (err) {
			if (err) rej(err);
			else res(this);
		});
	});
}

function get(sql, params = []) {
	return new Promise((res, rej) => {
		db.get(sql, params, (err, row) => {
			if (err) rej(err);
			else res(row);
		});
	});
}

function all(sql, params = []) {
	return new Promise((res, rej) => {
		db.all(sql, params, (err, rows) => {
			if (err) rej(err);
			else res(rows);
		});
	});
}

function getTodayDate() {
	return new Date().toISOString().split('T')[0];
}

function getDayNumber() {
	const d = new Date().getDay();
	return d === 0 ? 7 : d; // 1-7
}

/* -------------------- CREATE DAY -------------------- */

async function getOrCreateToday() {
	const date = getTodayDate();
	const dayNumber = getDayNumber();

	let day = await get(`SELECT * FROM days WHERE date = ?`, [date]);
	if (day) return day;

	const result = await run(`INSERT INTO days (date) VALUES (?)`, [date]);
	const dayId = result.lastID;

	// беремо шаблон з place_items
	const templates = await all(`
    SELECT *
    FROM place_items
  `);

	for (const t of templates) {
		if (t.days_of_week.includes(dayNumber.toString())) {
			await run(`
        INSERT INTO day_items (day_id, place_item_id, quantity, comment)
        VALUES (?, ?, ?, '')
      `, [dayId, t.id, t.default_quantity]);
		}
	}

	return { id: dayId, date };
}

/* -------------------- SHOW REQUEST -------------------- */

async function buildRequestText(dayId, date) {
	const rows = await all(`
    SELECT 
      di.quantity,
      di.comment,
      p.name as place,
      i.name as item
    FROM day_items di
    JOIN place_items pi ON di.place_item_id = pi.id
    JOIN places p ON pi.place_id = p.id
    JOIN items i ON pi.item_id = i.id
    WHERE di.day_id = ?
      AND di.quantity > 0
    ORDER BY p.id, i.id
  `, [dayId]);

	let text = `Заявка на ${date}\n\n`;
	let currentPlace = '';

	for (const row of rows) {
		if (row.place !== currentPlace) {
			currentPlace = row.place;
			text += `\n${currentPlace}\n`;
		}

		text += `• ${row.item} — ${row.quantity}`;
		if (row.comment) {
			text += ` (${row.comment})`;
		}
		text += `\n`;
	}

	return text;
}

/* -------------------- BOT -------------------- */

bot.start(async (ctx) => {
	const day = await getOrCreateToday();
	const text = await buildRequestText(day.id, day.date);
	ctx.reply(text);
});

bot.command('template', async (ctx) => {
	const places = await all(`SELECT * FROM places ORDER BY id`);

	const buttons = places.map(p =>
		[Markup.button.callback(p.name, `tpl_place_${p.id}`)]
	);

	ctx.reply('Оберіть місце для редагування шаблону:', Markup.inlineKeyboard(buttons));
});

bot.action(/tpl_place_(\d+)/, async (ctx) => {
	const placeId = ctx.match[1];

	const rows = await all(`
    SELECT 
      pi.id,
      i.name,
      pi.days_of_week,
      pi.default_quantity
    FROM place_items pi
    JOIN items i ON pi.item_id = i.id
    WHERE pi.place_id = ?
    ORDER BY i.id
  `, [placeId]);

	const buttons = rows.map(r => [
		Markup.button.callback(
			`${r.name} | дні: ${r.days_of_week} | к-сть: ${r.default_quantity}`,
			`tpl_item_${r.id}`
		)
	]);

	// 👇 нові кнопки
	buttons.push([
		Markup.button.callback('➕ Додати позицію', `tpl_add_${placeId}`)
	]);

	buttons.push([
		Markup.button.callback('❌ Видалити позицію', `tpl_remove_${placeId}`)
	]);

	await ctx.editMessageText(
		'Оберіть позицію або дію:',
		Markup.inlineKeyboard(buttons)
	);
});

bot.action(/tpl_item_(\d+)/, async (ctx) => {
	const placeItemId = ctx.match[1];

	await ctx.editMessageText(
		'Що змінити?',
		Markup.inlineKeyboard([
			[Markup.button.callback('✏️ Дні тижня', `tpl_days_${placeItemId}`)],
			[Markup.button.callback('🔢 Стартова кількість', `tpl_qty_${placeItemId}`)]
		])
	);
});

bot.action(/tpl_days_(\d+)/, async (ctx) => {
	const id = ctx.match[1];

	ctx.session = ctx.session || {};
	ctx.session.editDaysFor = id;

	await ctx.reply('Введи дні тижня у форматі:\n\n1,3,5\n\n(1=Пн ... 7=Нд)');
});

bot.on('text', async (ctx) => {
	const text = ctx.message.text.trim();

	// Створення нової позиції
	if (ctx.session?.addNewItemForPlace) {
		const placeId = ctx.session.addNewItemForPlace;
		const name = ctx.message.text.trim();

		// 1. додаємо в items
		await run(`
    INSERT OR IGNORE INTO items (name)
    VALUES (?)
  `, [name]);

		const item = await get(`SELECT id FROM items WHERE name = ?`, [name]);

		// 2. додаємо в шаблон місця
		await run(`
    INSERT INTO place_items
    (place_id, item_id, days_of_week, default_quantity)
    VALUES (?, ?, '1,2,3,4,5,6,7', 1)
  `, [placeId, item.id]);

		ctx.session.addNewItemForPlace = null;

		return ctx.reply(`✅ Позицію "${name}" створено і додано в шаблон`);
	}

	// Редагування днів
	if (ctx.session?.editDaysFor) {
		const id = ctx.session.editDaysFor;

		await run(`
      UPDATE place_items
      SET days_of_week = ?
      WHERE id = ?
    `, [text, id]);

		ctx.session.editDaysFor = null;
		return ctx.reply('✅ Дні оновлено');
	}

	// Редагування кількості
	if (ctx.session?.editQtyFor) {
		const id = ctx.session.editQtyFor;
		const qty = parseInt(text);

		if (isNaN(qty)) {
			return ctx.reply('Треба число');
		}

		await run(`
      UPDATE place_items
      SET default_quantity = ?
      WHERE id = ?
    `, [qty, id]);

		ctx.session.editQtyFor = null;
		return ctx.reply('✅ Кількість оновлено');
	}
});

bot.action(/tpl_qty_(\d+)/, async (ctx) => {
	const id = ctx.match[1];

	ctx.session = ctx.session || {};
	ctx.session.editQtyFor = id;

	await ctx.reply('Введи стартову кількість (число):');
});

bot.action(/tpl_add_(\d+)/, async (ctx) => {
	const placeId = ctx.match[1];

	await ctx.editMessageText(
		'Як додати позицію?',
		Markup.inlineKeyboard([
			[Markup.button.callback('📦 Обрати існуючу', `tpl_add_existing_${placeId}`)],
			[Markup.button.callback('🆕 Створити нову', `tpl_add_new_${placeId}`)]
		])
	);
});

bot.action(/tpl_add_existing_(\d+)/, async (ctx) => {
	const placeId = ctx.match[1];

	const items = await all(`SELECT * FROM items ORDER BY name`);

	const buttons = items.map(i => [
		Markup.button.callback(i.name, `tpl_add_item_${placeId}_${i.id}`)
	]);

	await ctx.editMessageText(
		'Оберіть позицію яку додати:',
		Markup.inlineKeyboard(buttons)
	);
});

bot.action(/tpl_add_new_(\d+)/, async (ctx) => {
	const placeId = ctx.match[1];

	ctx.session.addNewItemForPlace = placeId;

	await ctx.reply('Введи назву нової позиції:');
});

bot.action(/tpl_add_item_(\d+)_(\d+)/, async (ctx) => {
	const placeId = ctx.match[1];
	const itemId = ctx.match[2];

	await run(`
    INSERT OR IGNORE INTO place_items
    (place_id, item_id, days_of_week, default_quantity)
    VALUES (?, ?, '1,2,3,4,5,6,7', 1)
  `, [placeId, itemId]);

	await ctx.reply('✅ Позицію додано в шаблон');
});

bot.action(/tpl_remove_(\d+)/, async (ctx) => {
	const placeId = ctx.match[1];

	const rows = await all(`
    SELECT pi.id, i.name
    FROM place_items pi
    JOIN items i ON pi.item_id = i.id
    WHERE pi.place_id = ?
  `, [placeId]);

	const buttons = rows.map(r => [
		Markup.button.callback(`❌ ${r.name}`, `tpl_remove_item_${r.id}`)
	]);

	await ctx.editMessageText(
		'Оберіть позицію для видалення:',
		Markup.inlineKeyboard(buttons)
	);
});

bot.action(/tpl_remove_item_(\d+)/, async (ctx) => {
	const id = ctx.match[1];

	await run(`DELETE FROM place_items WHERE id = ?`, [id]);

	await ctx.reply('✅ Позицію видалено з шаблону');
});

/* -------------------- START -------------------- */

bot.launch();
console.log('Bot started');