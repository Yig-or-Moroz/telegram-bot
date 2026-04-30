const mainMenu = require('../keyboards/mainMenu');
const { getOrCreateTargetDay, formatDateUA } = require('../core/date');
const { getWorkCakesDetailed } = require('../services/workCakesBuilder');
const { esc } = require('../core/helpers');


module.exports = (bot) => {
	
	bot.hears('🎂 Торти в роботі', async (ctx) => {
		
		const day = await getOrCreateTargetDay();
		const cakes = await getWorkCakesDetailed(day.id);

		if (!cakes.length) {
			return ctx.reply('Немає тортів у роботі на цей день', mainMenu());
		}

		let text = `<i>Торти в роботі на ${formatDateUA(day.date)}</i>\n`;

		for (const c of cakes) {
			text += `\n\n<b>${esc(c.name)}</b>:\n`;

			if (c.normal) {
				text += `Звичайні — ${c.normal}\n`;
			}

			// ---------- Заказні ----------
			const customKeys = Object.keys(c.customsGrouped);
			if (customKeys.length) {
				text += `Заказні:\n`;
				for (const k of customKeys) {
					text += `      ${c.customsGrouped[k]} - ${esc(k)}\n`;
				}
			}

			// ---------- Доставка ----------
			const deliveryKeys = Object.keys(c.deliveryGrouped);
			if (deliveryKeys.length) {
				text += `Доставка:\n`;
				for (const k of deliveryKeys) {
					text += `      ${c.deliveryGrouped[k]} - ${esc(k)}\n`;
				}
			}
		}

		ctx.reply(text, { parse_mode: 'HTML', ...mainMenu() });
	});
}