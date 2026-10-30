
const { Markup } = require('telegraf');

const {
	formatDateUA,
	getShiftedDate,
	getOrCreateDayByDate
} = require('../core/date');

const { buildRequestText } = require('../services/requestBuilder');

module.exports = (bot) => {

	// 📄 Переглянути заявку
	bot.hears('📄 Переглянути заявку', async (ctx) => {
		try {
			ctx.session.state = null;

			const today = getShiftedDate(0);
			const tomorrow = getShiftedDate(1);
			const afterTomorrow = getShiftedDate(2);

			await ctx.reply(
				'Оберіть етап роботи:',
				Markup.inlineKeyboard([
					[
						Markup.button.callback(
							`🗳 Вивоз на ${formatDateUA(today)}`,
							`view_date_${today}`
						)
					],
					[
						Markup.button.callback(
							`🎂 Заявка на ${formatDateUA(tomorrow)}`,
							`view_date_${tomorrow}`
						)
					],
					[
						Markup.button.callback(
							`🥞 Заготовки на ${formatDateUA(afterTomorrow)}`,
							`view_date_${afterTomorrow}`
						)
					]
				])
			);

			console.log('[VIEW] Date selection menu sent');

		} catch (error) {
			console.error('[VIEW] Error opening menu:', error);

			try {
				await ctx.reply('Не вдалося відкрити меню. Спробуйте ще раз.');
			} catch (replyError) {
				console.error('[VIEW] Error sending fallback message:', replyError);
			}
		}
	});


	// Обробка вибору дати
	bot.action(/view_date_(\d{4}-\d{2}-\d{2})/, async (ctx) => {

		const date = ctx.match[1];

		console.log('\n[VIEW] =============================');
		console.log('[VIEW] Callback received');
		console.log('[VIEW] Date:', date);
		console.log('[VIEW] Update ID:', ctx.update.update_id);
		console.log('[VIEW] Callback ID:', ctx.callbackQuery.id);

		try {

			// Підтверджуємо натискання кнопки
			await ctx.answerCbQuery();

			console.log('[VIEW] Callback acknowledged');

			// Отримуємо або створюємо день
			console.log('[VIEW] Getting day...');

			const day = await getOrCreateDayByDate(date);

			console.log('[VIEW] Day received:', day);

			// Визначаємо режим перегляду
			let mode = 'normal';

			const afterTomorrow = getShiftedDate(2);

			if (date === afterTomorrow) {
				mode = 'preparation';
			}

			console.log('[VIEW] Mode:', mode);

			// Формуємо текст заявки
			console.log('[VIEW] Building request...');

			const requestText = await buildRequestText(
				day.id,
				day.date,
				mode
			);

			console.log('[VIEW] Request built');
			console.log('[VIEW] Text length:', requestText.length);

			// Перевіряємо, чи є що показувати
			if (!requestText.trim()) {
				await ctx.editMessageText('Заявка порожня.');
				console.log('[VIEW] Empty request sent');
				return;
			}

			// Відправляємо сформовану заявку
			console.log('[VIEW] Sending Telegram message...');

			await ctx.editMessageText(requestText, {
				parse_mode: 'HTML'
			});

			console.log('[VIEW] Message sent successfully');

		} catch (error) {

			// Telegram повертає 400, якщо текст повідомлення не змінився
			if (
				error.response?.error_code === 400 &&
				error.response?.description?.includes('message is not modified')
			) {
				console.log('[VIEW] Message was not modified. Nothing to update.');
				return;
			}

			console.error('[VIEW] ERROR:', error);
			console.error('[VIEW] Error description:', error.response?.description || error.message);

			// Повідомляємо користувача про помилку
			try {
				await ctx.reply(
					'Не вдалося відкрити заявку. Спробуйте натиснути кнопку ще раз.'
				);
			} catch (replyError) {
				console.error('[VIEW] Could not send error message:', replyError);
			}
		}

		console.log('[VIEW] =============================\n');
	});

};


