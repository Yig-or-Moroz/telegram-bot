const db = require('./db');

function run(sql, params = []) {
	return new Promise((res, rej) => {
		db.run(sql, params, function (err) {
			if (err) rej(err);
			else res(this);
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

async function seedDatabase() {
	console.log('Seeding database...');

	/* ---------- PLACES ---------- */

	const places = [
		{ name: "Соборна", days: "1,3,5" },
		{ name: "Петроцентр", days: "1,3,5" },
		{ name: "Вокзал", days: "1,3,5" },
		{ name: "Пирогова", days: "1,2,4,6" },
		{ name: "Космо", days: "1,2,4,6" },
		{ name: "Доставка", days: "1,2,3,4,5,6,7" },
	];

	for (const p of places) {
		await run(
			`INSERT INTO places (name, days_of_week) VALUES (?, ?)`,
			[p.name, p.days]
		);
	}

	/* ---------- ITEMS ---------- */

	const items = [
		"Оксамит", "Тоффі", "Фісташка", "Манго", "Рулет", "Амаретто",
		"Міні Фісташка", "Міні Тоффі", "Міні Оксамит",
		"Міні Амаретто", "Міні Свято", "Міні Birthday Cake", "Снікерс"
	];

	for (const name of items) {
		await run(`INSERT INTO items (name) VALUES (?)`, [name]);
	}

	/* ---------- PLACE_ITEMS (шаблон) ---------- */

	const placeRows = await all(`SELECT * FROM places`);
	const itemRows = await all(`SELECT * FROM items`);

	for (const place of placeRows) {
		for (const item of itemRows) {
			const defaultQty = place.name === "Доставка" ? 0 : 1;

			await run(`
				INSERT INTO place_items
				(place_id, item_id, default_quantity)
				VALUES (?, ?, ?)
			`, [place.id, item.id, defaultQty]);
		}
	}

	console.log('Database seeded!');
	process.exit(0);
}

seedDatabase();