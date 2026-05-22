const { get } = require('../core/db');
const { formatDateUA, getShiftedDate } = require('../core/date');
const { buildRequestText } = require('../services/requestBuilder');
const { Markup } = require('telegraf');

module.exports = (bot) => {

	bot.hears('🗂 Попередні заявки', async (ctx) => {

		ctx.session.state = null;

		const buttons = [];

		// від 1 до 10 днів назад (1 = вчора)
		for (let i = 1; i <= 10; i++) {
			const date = getShiftedDate(-i);

			const day = await get(
				`SELECT id FROM days WHERE date = ?`,
				[date]
			);

			// показуємо тільки якщо день існує в БД
			if (day) {
				buttons.push([
					Markup.button.callback(
						formatDateUA(date),
						`history_day_${day.id}`
					)
				]);
			}
		}

		if (!buttons.length) {
			return ctx.reply('Немає попередніх заявок');
		}

		await ctx.reply(
			'Оберіть дату:',
			Markup.inlineKeyboard(buttons)
		);
	});


	bot.action(/^history_day_(\d+)/, async (ctx) => {
		const dayId = ctx.match[1];

		const day = await get(
			`SELECT * FROM days WHERE id = ?`,
			[dayId]
		);

		await ctx.editMessageText(
			await buildRequestText(day.id, day.date),
			{ parse_mode: 'HTML' }
		);
	});

};