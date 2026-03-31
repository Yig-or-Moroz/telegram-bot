require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);

/*
bot.start((ctx) => {
	db.all(`SELECT * FROM test`, [], (err, rows) => {
		if (err) {
			ctx.reply('DB error');
			return;
		}

		let message = 'Дані з бази:\n\n';
		rows.forEach((row) => {
			message += `${row.id}. ${row.name}\n`;
		});

		ctx.reply(message);
	});
});

db.serialize(() => {
	// Додаємо заклади
	db.run(`INSERT INTO places (name) VALUES (?)`, ["O'cake #1"]);
	db.run(`INSERT INTO places (name) VALUES (?)`, ["O'cake #2"]);
	db.run(`INSERT INTO places (name) VALUES (?)`, ["O'cake #3"]);
	db.run(`INSERT INTO places (name) VALUES (?)`, ["O'cake #4"]);
	db.run(`INSERT INTO places (name) VALUES (?)`, ["O'cake #5"]);

	// Додаємо позиції для Закладу #1 (place_id = 1)
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Вісім', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, "П'ятнадцять", 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Сорок', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Манго', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Рулет', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Міні Фісташка', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Міні Тоффі', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Міні Осаке', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Міні Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (1, 'Міні Birthday Cake', 0)`);

	// Позиції для Закладу #2 (place_id = 2)
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Вісім', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, "П'ятнадцять", 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Сорок', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Манго', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Рулет', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Міні Фісташка', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Міні Тоффі', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Міні Осаке', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Міні Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (2, 'Міні Birthday Cake', 0)`);
	
	// Позиції для Закладу #3 (place_id = 3)
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Вісім', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, "П'ятнадцять", 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Сорок', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Манго', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Рулет', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Міні Фісташка', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Міні Тоффі', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Міні Осаке', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Міні Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (3, 'Міні Birthday Cake', 0)`);
	
	// Позиції для Закладу #4 (place_id = 4)
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Вісім', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, "П'ятнадцять", 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Сорок', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Манго', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Рулет', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Міні Фісташка', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Міні Тоффі', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Міні Осаке', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Міні Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (4, 'Міні Birthday Cake', 0)`);
	
	// Позиції для Закладу #5 (place_id = 5)
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Вісім', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, "П'ятнадцять", 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Сорок', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Манго', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Рулет', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Міні Фісташка', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Міні Тоффі', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Міні Осаке', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Міні Амаретто', 0)`);
	db.run(`INSERT INTO items (place_id, name, default_quantity) VALUES (5, 'Міні Birthday Cake', 0)`);
});
*/

bot.launch();

console.log('Bot started');