require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);

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

bot.launch();

console.log('Bot started');