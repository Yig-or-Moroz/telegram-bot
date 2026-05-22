const { Markup } = require('telegraf');

module.exports = () =>
	Markup.keyboard([
		['🎂 Торти в роботі'],
		['📄 Переглянути заявку'],
		['✏️ Редагувати заявку'],
		['🧩 Змінити шаблон'],
		['🗂 Попередні заявки']
	])
	.resize();