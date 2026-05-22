const { Markup } = require('telegraf');
const mainMenu = require('../keyboards/mainMenu');
const { formatDateUA, getShiftedDate, getOrCreateDayByDate } = require('../core/date');
const { getWorkCakesDetailed } = require('../services/workCakesBuilder');
const { esc } = require('../core/helpers');


module.exports = (bot) => {
	
	bot.hears('🎂 Торти в роботі', async (ctx) => {

		ctx.session.state = null;

		const today = getShiftedDate(0);
		const tomorrow = getShiftedDate(1);
		const afterTomorrow = getShiftedDate(2);

		await ctx.reply(
			'Оберіть етап роботи:',
			Markup.inlineKeyboard([
				[Markup.button.callback(`🗳 Вивоз на ${formatDateUA(today)}`, `cakes_${today}`)],
				[Markup.button.callback(`🎂 Заявка на ${formatDateUA(tomorrow)}`, `cakes_${tomorrow}`)],
				[Markup.button.callback(`🥞 Заготовки на ${formatDateUA(afterTomorrow)}`, `cakes_${afterTomorrow}`)],
			])
		);
	});

	bot.action(/cakes_(.+)/, async (ctx) => {
		const date = ctx.match[1];
		const day = await getOrCreateDayByDate(date);

		const cakes = await getWorkCakesDetailed(day.id, day.date);

		if (!cakes.length) {
			await ctx.editMessageText('Немає тортів у роботі на цей день');
			return ctx.reply('Головне меню:', mainMenu());
		}

		let text = `<i>Торти в роботі на ${formatDateUA(day.date)}</i>\n`;

		for (const c of cakes) {
			text += `\n\n<b>${esc(c.name)}</b>:\n`;

			if (c.normal) text += `Звичайні — ${c.normal}\n`;

			const customKeys = Object.keys(c.customsGrouped);
			if (customKeys.length) {
				text += `Заказні:\n`;
				for (const k of customKeys) {
					text += `      ${c.customsGrouped[k]} - ${esc(k)}\n`;
				}
			}

			const deliveryKeys = Object.keys(c.deliveryGrouped);
			if (deliveryKeys.length) {
				text += `Доставка:\n`;
				for (const k of deliveryKeys) {
					text += `      ${c.deliveryGrouped[k]} - ${esc(k)}\n`;
				}
			}
		}

		await ctx.editMessageText(text, { parse_mode: 'HTML' });
	});
}