const bot = require('../bot/bot');
const chats = require('../bot/chatList');

    bot.onText(/\/echo (.+)/, (msg, match) => {
        // 'msg' is the received Message from Telegram
        // 'match' is the result of executing the regexp above on the text content
        // of the message

        const resp = match[1]; // the captured "whatever"

        // send back the matched "whatever" to the chat
        bot.sendMessage(chats.me, resp)
            .then(()=> console.log('ok'));
    });

module.exports = bot;
