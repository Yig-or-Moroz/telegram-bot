const { all, run } = require('../core/db');
const { Markup } = require('telegraf');

module.exports = (bot) => {

	// 🔐 Секретне слово
	bot.hears(/^shazam$/i, async (ctx) => {

		ctx.session.state = null;	

		await ctx.reply(
			'🛠 Адмін меню:',
			Markup.inlineKeyboard([
				[Markup.button.callback('🏢 Заклади', 'admin_places')],
				[Markup.button.callback('💣 Видалити позицію назавжди', 'admin_delete_item')]
			])
		);
	});

	/* -------------------- PLACES -------------------- */

	bot.action('admin_places', async (ctx) => {
		await ctx.editMessageText(
			'Керування закладами:',
			Markup.inlineKeyboard([
				[Markup.button.callback('➕ Додати заклад', 'admin_add_place')],
				[Markup.button.callback('❌ Видалити заклад', 'admin_remove_place')]
			])
		);
	});

	bot.action('admin_add_place', async (ctx) => {
		ctx.session.state = 'adminAddPlace';
		await ctx.reply('Введіть назву нового закладу:');
	});

	bot.action('admin_remove_place', async (ctx) => {
		const places = await all(`SELECT id, name FROM places ORDER BY name`);

		await ctx.editMessageText(
			'Оберіть заклад для видалення:',
			Markup.inlineKeyboard(
				places.map(p => [
					Markup.button.callback(p.name, `admin_remove_place_${p.id}`)
				])
			)
		);
	});

	bot.action(/^admin_remove_place_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		// Каскадне видалення
		await run(`DELETE FROM day_items WHERE place_id = ?`, [placeId]);
		await run(`DELETE FROM place_items WHERE place_id = ?`, [placeId]);
		await run(`DELETE FROM places WHERE id = ?`, [placeId]);

		await ctx.editMessageText('✅ Заклад видалено повністю');
	});

	/* -------------------- DELETE ITEM FOREVER -------------------- */

	bot.action('admin_delete_item', async (ctx) => {
		const items = await all(`SELECT id, name FROM items ORDER BY name`);

		await ctx.editMessageText(
			'Оберіть позицію для повного видалення:',
			Markup.inlineKeyboard(
				items.map(i => [
					Markup.button.callback(i.name, `admin_delete_item_${i.id}`)
				])
			)
		);
	});

	bot.action(/^admin_delete_item_(\d+)$/, async (ctx) => {
		const itemId = ctx.match[1];

		// Каскадне видалення ВСЮДИ
		await run(`DELETE FROM day_items WHERE item_id = ?`, [itemId]);
		await run(`DELETE FROM place_items WHERE item_id = ?`, [itemId]);
		await run(`DELETE FROM items WHERE id = ?`, [itemId]);

		await ctx.editMessageText('💥 Позицію видалено назавжди з усієї системи');
	});
};