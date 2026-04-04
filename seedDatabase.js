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

	const places = ["Соборна", "Пирогова", "Космо", "Петроцентр", "Вокзал", "Доставка"];
	const items = [
		"Оксамит", "Тоффі", "Фісташка", "Манго", "Рулет", "Амаретто",
		"Міні Фісташка", "Міні Тоффі", "Міні Оксамит",
		"Міні Амаретто", "Міні Свято", "Міні Birthday Cake", "Снікерс"
	];

	// Додаємо місця
	for (const name of places) {
		await run(`INSERT OR IGNORE INTO places (name) VALUES (?)`, [name]);
	}

	// Додаємо позиції
	for (const name of items) {
		await run(`INSERT OR IGNORE INTO items (name) VALUES (?)`, [name]);
	}

	const placeRows = await all(`SELECT * FROM places`);
	const itemRows = await all(`SELECT * FROM items`);

	// Наприклад, assign days_of_week як раніше
	for (const place of placeRows) {
		let days;

		if (["Соборна", "Петроцентр", "Вокзал"].includes(place.name)) {
			days = "1,3,5";
		} else if (["Пирогова", "Космо"].includes(place.name)) {
			days = "1,2,4,6";
		} else {
			days = "1,2,3,4,5,6,7"; // Доставка
		}

		for (const item of itemRows) {
			const default_quantity = place.name === "Доставка" ? 0 : 1;

			await run(`
      INSERT OR IGNORE INTO place_items
      (place_id, item_id, days_of_week, default_quantity)
      VALUES (?, ?, ?, ?)`,
				[place.id, item.id, days, default_quantity]
			);
		}
	}

	console.log('Database seeded!');
	process.exit(0);
}

seedDatabase();