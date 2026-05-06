const mainMenu = require('../keyboards/mainMenu');

module.exports = (bot) => {
	bot.start(async (ctx) => {
		await ctx.reply('Вітаю 👋 Оберіть дію:', mainMenu());
	});
};