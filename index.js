const db = require('./db');

db.run(
	"INSERT INTO test (name) VALUES (?)",
	['Ihor'],

	function (err) {
		if (err) {
			console.error(err);
			return;
		}


		db.all(`SELECT * FROM test`, [], (err, rows) => {
			console.log('Before update: ', rows);


			db.run('UPDATE test SET name = ? WHERE id = ?',
				['Piter', this.lastID],
				function (err) {
					if (err) {
						console.error(err);
						return;
					}


					db.all(`SELECT * FROM test`, [], (err, rows) => {
						console.log('After update:', rows);
					});
				}
			);
		});
	}
);



const { Telegraf } = require('telegraf');

const bot = new Telegraf('8681129054:AAGiRSq_A3TIfIdN51qo0STZC3YN7CEcaJk');

bot.start((ctx) => {
	ctx.reply('Привіт! Я працюю 🤖');
});

bot.on('text', (ctx) => {
	ctx.reply(`Ти написав: ${ctx.message.text}`);
});

bot.launch();

console.log('Bot started');