const TelegramBot = require('node-telegram-bot-api');
// chatId: -449604345
// replace the value below with the Telegram token you receive from @BotFather
const token = '1171615656:AAHXgcBh0f34TkJ45Uj3a6r7N4B5Z8uEQK4';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

module.exports = bot;
