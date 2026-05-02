const { all, get } = require('../core/db');
const { formatDateUA } = require('../core/date');
const { buildRequestText } = require('../services/requestBuilder');
const { Markup } = require('telegraf');

module.exports = (bot) => {

	bot.hears('🗂 Попередні заявки', async (ctx) => {
		const days = await all(`
			SELECT id, date 
			FROM days 
			ORDER BY date DESC
			LIMIT 10
		`);

		ctx.reply(
			'Оберіть дату:',
			Markup.inlineKeyboard(
				days.map(d => [
					Markup.button.callback(formatDateUA(d.date), `view_day_${d.id}`)
				])
			)
		);
	});

	bot.action(/^view_day_(\d+)/, async (ctx) => {
		const day = await get(`SELECT * FROM days WHERE id = ?`, [ctx.match[1]]);
		ctx.editMessageText(await buildRequestText(day.id, day.date), { parse_mode: 'HTML' });
	});
};