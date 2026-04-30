require('dotenv').config();
const { Telegraf, session } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

bot.use((ctx, next) => {
	ctx.session = ctx.session || {};
	return next();
});

require('./handlers/start')(bot);
require('./handlers/view')(bot);
require('./handlers/edit')(bot);
require('./handlers/template')(bot);
require('./handlers/history')(bot);
require('./handlers/workCakes')(bot);
require('./handlers/textState')(bot);

bot.launch();
console.log('Bot started');