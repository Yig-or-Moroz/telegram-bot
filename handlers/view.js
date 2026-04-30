const mainMenu = require('../keyboards/mainMenu');
const { getOrCreateTargetDay } = require('../core/date');
const { buildRequestText } = require('../services/requestBuilder');

module.exports = (bot) => {
	bot.hears('📄 Переглянути заявку', async (ctx) => {
		const day = await getOrCreateTargetDay();
		ctx.reply(await buildRequestText(day.id, day.date), {
			...mainMenu(),
			parse_mode: 'HTML'
		});
	});
};