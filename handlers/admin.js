const { all, run } = require('../core/db');
const { Markup } = require('telegraf');

function adminMainMenu() {
	return Markup.inlineKeyboard([
		[Markup.button.callback('🏢 Заклади', 'admin_places')],
		[Markup.button.callback('💣 Видалити позицію назавжди', 'admin_delete_item')],
		[Markup.button.callback('🎂 Торти з особливими властивостями', 'admin_item_features')]
	]);
}

module.exports = (bot) => {

	// 🔐 Секретне слово
	bot.hears(/^shazam$/i, async (ctx) => {

		ctx.session.state = null;	

		await ctx.reply(
			'🛠 Адмін меню:',
			adminMainMenu()
		);
	});

	bot.action('admin_back_main', async (ctx) => {
		await ctx.editMessageText(
			'🛠 Адмін меню:',
			adminMainMenu()
		);
	});

	/* -------------------- PLACES -------------------- */

	bot.action('admin_places', async (ctx) => {
		await ctx.editMessageText(
			'Керування закладами:',
			Markup.inlineKeyboard([
				[Markup.button.callback('➕ Додати заклад', 'admin_add_place')],
				[Markup.button.callback('❌ Видалити заклад', 'admin_remove_place')],
				[Markup.button.callback('⬅️ Назад', 'admin_back_main')]
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
			Markup.inlineKeyboard([
				...places.map(p => [
					Markup.button.callback(p.name, `admin_remove_place_${p.id}`)
				]),
				[Markup.button.callback('⬅️ Назад', 'admin_places')]
			])
		);
	});

	bot.action(/^admin_remove_place_(\d+)$/, async (ctx) => {
		const placeId = ctx.match[1];

		// Каскадне видалення
		await run(`DELETE FROM day_items WHERE place_id = ?`, [placeId]);
		await run(`DELETE FROM place_items WHERE place_id = ?`, [placeId]);
		await run(`DELETE FROM places WHERE id = ?`, [placeId]);

		await ctx.answerCbQuery('✅ Заклад видалено повністю');

		return ctx.editMessageText('🛠 Адмін меню:', adminMainMenu());
	});

	/* -------------------- DELETE ITEM FOREVER -------------------- */

	bot.action('admin_delete_item', async (ctx) => {
		const items = await all(`SELECT id, name FROM items ORDER BY name`);

		await ctx.editMessageText(
			'Оберіть позицію для повного видалення:',
			Markup.inlineKeyboard([
				...items.map(i => [
					Markup.button.callback(i.name, `admin_delete_item_${i.id}`)
				]),
				[Markup.button.callback('⬅️ Назад', 'admin_back_main')]
			])
		);
	});

	bot.action(/^admin_delete_item_(\d+)$/, async (ctx) => {
		const itemId = ctx.match[1];

		// Каскадне видалення ВСЮДИ
		await run(`DELETE FROM day_items WHERE item_id = ?`, [itemId]);
		await run(`DELETE FROM place_items WHERE item_id = ?`, [itemId]);
		await run(`DELETE FROM items WHERE id = ?`, [itemId]);

		await ctx.answerCbQuery('💥 Позицію видалено назавжди з усієї системи');

		return ctx.editMessageText('🛠 Адмін меню:', adminMainMenu());
	});

//------------------------ ITEM FEATURES---------------------------

	bot.action('admin_item_features', async (ctx) => {
		const items = await all(`SELECT id, name FROM items ORDER BY name`);

		await ctx.editMessageText(
			'Оберіть торт:',
			Markup.inlineKeyboard([
				...items.map(i => [
					Markup.button.callback(i.name, `admin_item_feat_${i.id}`)
				]),
				[Markup.button.callback('⬅️ Назад', 'admin_back_main')]
			])
		);
	});

	bot.action(/^admin_item_feat_(\d+)$/, async (ctx) => {
		const itemId = ctx.match[1];

		ctx.session.featureItemId = itemId;

		await ctx.editMessageText(
			'Оберіть дію:',
			Markup.inlineKeyboard([
				[Markup.button.callback('Тільки на замовлення', `feat_add_1_${itemId}`)],
				[Markup.button.callback('Завжди доробляти зранку', `feat_add_2_${itemId}`)],
				[Markup.button.callback('Заготовки не робляться', `feat_add_3_${itemId}`)],
				[Markup.button.callback('❌ Прибрати всі особливості', `feat_clear_${itemId}`)],
				[Markup.button.callback('⬅️ Назад', 'admin_item_features')]
			])
		);
	});

	async function addFeature(itemId, featureId, ctx) {
		await run(`
			INSERT OR IGNORE INTO item_features (item_id, feature_id)
			VALUES (?, ?)
		`, [itemId, featureId]);

		await ctx.answerCbQuery('Додано ✅');
	}	


	bot.action(/feat_add_1_(\d+)/, async (ctx) => {
		await addFeature(ctx.match[1], 1, ctx);
	});

	bot.action(/feat_add_2_(\d+)/, async (ctx) => {
		await addFeature(ctx.match[1], 2, ctx);
	});

	bot.action(/feat_add_3_(\d+)/, async (ctx) => {
		await addFeature(ctx.match[1], 3, ctx);
	});

	bot.action(/feat_clear_(\d+)/, async (ctx) => {
		const itemId = ctx.match[1];

		await run(`
			DELETE FROM item_features
			WHERE item_id = ?
		`, [itemId]);

		await ctx.answerCbQuery('Очищено ❌');

		return ctx.editMessageText('🛠 Адмін меню:', adminMainMenu());
	});

};