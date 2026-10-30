const { Markup } = require('telegraf');
const mainMenu = require('../keyboards/mainMenu');
const { formatDateUA, getShiftedDate, getOrCreateDayByDate } = require('../core/date');
const { buildRequestText } = require('../services/requestBuilder');

module.exports = (bot) => {
	bot.hears('📄 Переглянути заявку', async (ctx) => {

		ctx.session.state = null;

		const today = getShiftedDate(0);
		const tomorrow = getShiftedDate(1);
		const afterTomorrow = getShiftedDate(2);

		await ctx.reply(
			'Оберіть етап роботи:',
			Markup.inlineKeyboard([
				[Markup.button.callback(`🗳 Вивоз на ${formatDateUA(today)}`, `view_date_${today}`)],
				[Markup.button.callback(`🎂 Заявка на ${formatDateUA(tomorrow)}`, `view_date_${tomorrow}`)],
				[Markup.button.callback(`🥞 Заготовки на ${formatDateUA(afterTomorrow)}`, `view_date_${afterTomorrow}`)],
			])
		);
	});
	/*
		bot.action(/view_date_(\d{4}-\d{2}-\d{2})/, async (ctx) => {
			const date = ctx.match[1];
			const day = await getOrCreateDayByDate(date);
	
			let mode = 'normal';
	
			const afterTomorrow = getShiftedDate(2);
	
			// якщо відкрили "Заготовки"
			if (date === afterTomorrow) {
				mode = 'preparation';
			}
	
			await ctx.editMessageText(
				await buildRequestText(day.id, day.date, mode),
				{
					parse_mode: 'HTML'
				}
			);
		});*/
	bot.action(/view_date_(\d{4}-\d{2}-\d{2})/, async (ctx) => {
		const date = ctx.match[1];

		console.log('[VIEW] 1. Callback received:', date);

		try {
			console.log('[VIEW] 2. Getting day...');
			const day = await getOrCreateDayByDate(date);
			console.log('[VIEW] 3. Day received:', day);

			let mode = 'normal';
			const afterTomorrow = getShiftedDate(2);

			if (date === afterTomorrow) {
				mode = 'preparation';
			}

			console.log('[VIEW] 4. Building request...');
			const requestText = await buildRequestText(
				day.id,
				day.date,
				mode
			);

			console.log('[VIEW] 5. Request built. Length:', requestText.length);

			console.log('[VIEW] 6. Sending Telegram message...');

			await ctx.editMessageText(requestText, {
				parse_mode: 'HTML'
			});

			console.log('[VIEW] 7. Message sent successfully');

		} catch (error) {
			console.error('[VIEW] ERROR:', error);
		}
	});
};

