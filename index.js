
require('dotenv').config();

const { Telegraf, session } = require('telegraf');


// Перевіряємо наявність токена
if (!process.env.BOT_TOKEN) {
	console.error('[BOT] ERROR: BOT_TOKEN is not configured');
	process.exit(1);
}


// Створюємо бота
const bot = new Telegraf(process.env.BOT_TOKEN);


// Підключаємо сесії
bot.use(session());


// Перевіряємо сесію
bot.use((ctx, next) => {
	ctx.session = ctx.session || {};

	return next();
});


// Підключаємо обробники
require('./handlers/start')(bot);
require('./handlers/view')(bot);
require('./handlers/edit')(bot);
require('./handlers/template')(bot);
require('./handlers/history')(bot);
require('./handlers/workCakes')(bot);
require('./handlers/admin')(bot);
require('./handlers/textState')(bot);


// Глобальна обробка помилок Telegraf
bot.catch((error, ctx) => {
	console.error('\n[BOT] Unhandled error');
	console.error('[BOT] Update ID:', ctx.update?.update_id);
	console.error('[BOT] Update type:', ctx.updateType);
	console.error('[BOT] Error:', error);
	console.error('[BOT] Description:', error.response?.description || error.message);
});


// Запуск бота
async function startBot() {
	try {
		console.log('[BOT] Starting...');

		await bot.launch();

		console.log('[BOT] Bot started successfully');

	} catch (error) {
		console.error('[BOT] Failed to start:', error);
		process.exit(1);
	}
}


// Коректне завершення роботи
process.once('SIGINT', () => {
	console.log('[BOT] Stopping...');
	bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
	console.log('[BOT] Stopping...');
	bot.stop('SIGTERM');
});


// Запускаємо
startBot();
