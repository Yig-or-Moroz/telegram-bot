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

async function seedItems() {
	for (const name of baseItems()) {
		await run(`INSERT OR IGNORE INTO items (name) VALUES (?)`, [name]);
	}
}

async function seedPlaces() {
	const places = [
		"Соборна",
		"Пирогова",
		"Космо",
		"Петроцентр",
		"Вокзал",
		"Доставка"
	];

	for (const name of places) {
		await run(`INSERT OR IGNORE INTO places (name) VALUES (?)`, [name]);
	}
}

async function seedPlaceItems() {
	const items = await all(`SELECT * FROM items`);
	const places = await all(`SELECT * FROM places`);

	const placeMap = {};
	places.forEach(p => placeMap[p.name] = p.id);

	const itemMap = {};
	items.forEach(i => itemMap[i.name] = i.id);

	// 1,3,5
	for (const place of ["Соборна", "Вокзал", "Вокзал"]) {
		for (const name of baseItems()) {
			await run(`
        INSERT OR IGNORE INTO place_items (place_id, item_id, days_of_week)
        VALUES (?, ?, ?)
      `, [placeMap[place], itemMap[name], "1,3,5"]);
		}
	}

	// 1,2,4,6
	for (const place of ["Пирогова", "Космо"]) {
		for (const name of baseItems()) {
			await run(`
        INSERT OR IGNORE INTO place_items (place_id, item_id, days_of_week)
        VALUES (?, ?, ?)
      `, [placeMap[place], itemMap[name], "1,2,4,6"]);
		}
	}

	// Доставка — але days є, просто quantity = 0 при створенні дня
	for (const name of baseItems()) {
		await run(`
      INSERT OR IGNORE INTO place_items (place_id, item_id, days_of_week)
      VALUES (?, ?, ?)
    `, [placeMap["Доставка"], itemMap[name], "1,2,3,4,5,6,7"]);
	}
}

function baseItems() {
	return [
		"Оксамит", "Тоффі", "Фісташка", "Манго", "Рулет", "Амаретто",
		"Міні Фісташка", "Міні Тоффі", "Міні Оксамит",
		"Міні Амаретто", "Міні Свято", "Міні Birthday Cake", "Снікерс"
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

	const placeItems = await all(`
    SELECT pi.*, p.name as place
    FROM place_items pi
    JOIN places p ON pi.place_id = p.id
  `);

	for (const pi of placeItems) {
		if (pi.days_of_week.includes(dayNumber.toString())) {

			const quantity = pi.place === "Доставка" ? 0 : 1;

			await run(`
        INSERT INTO day_items (day_id, place_item_id, quantity)
        VALUES (?, ?, ?)
      `, [dayId, pi.id, quantity]);
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
  JOIN place_items pi ON di.place_item_id = pi.id
  JOIN items i ON pi.item_id = i.id
  JOIN places p ON pi.place_id = p.id
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

(async () => {
	await seedItems();
	await seedPlaces();
	await seedPlaceItems();

	console.log('Seeding done');
	bot.launch();
})();