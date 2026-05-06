const { Markup } = require('telegraf');
const mainMenu = require('../keyboards/mainMenu');
const { formatDateUA, getShiftedDate, getOrCreateDayByDate } = require('../core/date');
const { buildRequestText } = require('../services/requestBuilder');

module.exports = (bot) => {
	bot.hears('📄 Переглянути заявку', async (ctx) => {
		const today = getShiftedDate(0);
		const tomorrow = getShiftedDate(1);
		const afterTomorrow = getShiftedDate(2);

		await ctx.reply(
			'Оберіть етап роботи:',
			Markup.inlineKeyboard([
				[Markup.button.callback(`🔧 Доробити на ${formatDateUA(today)}`, `view_date_${today}`)],
				[Markup.button.callback(`🎂 Обтягнути на ${formatDateUA(tomorrow)}`, `view_date_${tomorrow}`)],
				[Markup.button.callback(`🍰 Намастити на ${formatDateUA(afterTomorrow)}`, `view_date_${afterTomorrow}`)],
			])
		);
	});

	bot.action(/view_date_(\d{4}-\d{2}-\d{2})/, async (ctx) => {
		const date = ctx.match[1];
		const day = await getOrCreateDayByDate(date);

		await ctx.editMessageText(
			await buildRequestText(day.id, day.date),
			{
				parse_mode: 'HTML'
			}
		);
	});
};

