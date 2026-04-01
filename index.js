require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);

function getTodayDate() {
	return new Date().toISOString().split('T')[0];
}

function getDayNumber() {
	const d = new Date().getDay();
	return d === 0 ? 7 : d; // 1-7 (Mon-Sun)
}

/* -------------------- SEED DATABASE -------------------- */

async function seedDatabase() {
	// Places
	const places = [
		"O'cake #1",
		"O'cake #2",
		"O'cake #3",
		"O'cake #4",
		"O'cake #5",
		"Доставка"
	];

	for (const name of places) {
		await run(`INSERT OR IGNORE INTO places (name) VALUES (?)`, [name]);
	}

	// Map id by name
	const placesMap = {};
	const rows = await all(`SELECT id, name FROM places`);
	rows.forEach(p => placesMap[p.name] = p.id);

	// Items template
	const templateItems = [
		// 1,3,5
		...["O'cake #1", "O'cake #4", "O'cake #5"].flatMap(place =>
			baseItems().map(name => ({ name, days: "1,3,5", place }))
		),

		// 1,2,4,6
		...["O'cake #2", "O'cake #3"].flatMap(place =>
			baseItems().map(name => ({ name, days: "1,2,4,6", place }))
		),

		// Delivery every day
		...baseItems().map(name => ({
			name,
			days: "1,2,3,4,5,6,7",
			place: "Доставка"
		}))
	];

	for (const it of templateItems) {
		await run(
			`INSERT OR IGNORE INTO items (name, days_of_week, place_id)
       VALUES (?, ?, ?)`,
			[it.name, it.days, placesMap[it.place]]
		);
	}

	console.log('DB seeded');
}

function baseItems() {
	return [
		"8", "15", "40", "Манго", "Рулет", "Амаретто",
		"Міні Фісташка", "Міні Тоффі", "Міні Оксамит",
		"Міні Амаретто", "Міні Birthday Cake"
	];
}

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

/* -------------------- CREATE DAY -------------------- */

async function getOrCreateToday() {
	const date = getTodayDate();
	const dayNumber = getDayNumber();

	let day = await get(`SELECT * FROM days WHERE date = ?`, [date]);
	if (day) return day;

	const result = await run(`INSERT INTO days (date) VALUES (?)`, [date]);
	const dayId = result.lastID;

	const items = await all(`SELECT * FROM items`);

	for (const item of items) {
		if (item.days_of_week.includes(dayNumber.toString())) {

			// Дізнаємось до якого місця належить item
			const place = await get(
				`SELECT name FROM places WHERE id = ?`,
				[item.place_id]
			);

			// Якщо це "Доставка" → quantity = 0
			const qty = place.name === 'Доставка' ? 0 : 1;

			await run(
				`INSERT INTO day_items (day_id, item_id, quantity)
       VALUES (?, ?, ?)`,
				[dayId, item.id, qty]
			);
		}
	}

	return { id: dayId, date };
}

/* -------------------- BOT -------------------- */

bot.start(async (ctx) => {
	const day = await getOrCreateToday();

	const rows = await all(`
    SELECT di.quantity, i.name, p.name as place
    FROM day_items di
    JOIN items i ON di.item_id = i.id
    JOIN places p ON i.place_id = p.id
    WHERE di.day_id = ? AND di.quantity > 0
    ORDER BY p.id, i.id
  `, [day.id]);

	let text = `Заявка на ${day.date}\n\n`;
	let currentPlace = '';

	rows.forEach(row => {
		if (row.place !== currentPlace) {
			currentPlace = row.place;
			text += `\n${currentPlace}\n`;
		}
		text += `• ${row.name} — ${row.quantity}\n`;
	});

	ctx.reply(text);
});

/* -------------------- START -------------------- */

seedDatabase().then(() => {
	bot.launch();
});