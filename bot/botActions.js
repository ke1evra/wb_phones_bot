const bot = require('./bot.js');
const chats = require('./chatList.js');
const moment = require('moment');
const htmlToText = require('html-to-text');
const gApi = require('../googleApi/googleApiManager.js');
const menu = require('../analytics/menu.js');

const shortenMessage = (str, len = 400) => {
    let shortStr = '';
    shortStr = str.split('', len).join('') + '...';
    return shortStr;
};



const methods = {
    sendMessageFromZebra(b) {
        const chat = chats.wb_phones;
        const message = `sms от ${b.src} на ${b.dst} (${moment().format('DD.MM.YYYY HH:mm:ss')})\n---------------------\n${b.body}`;
        return bot.sendMessage(chat, message).then(() => {
          console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
        }).catch(e => {
          console.log(e);
        });
    },
    formatEmailMessage(b){
        let text = htmlToText.fromString(b.html, {
            wordwrap: false,
            ignoreImage: true,
        });
        text = text.replace(/[\r\n]{3,}/g, "\n\n");
        return `${b.from.value[0].name} <${b.from.value[0].address}> (${moment(b.date).format('DD.MM.YYYY HH:mm:ss')})\n${b.subject}\n---------------------\n${text}`;
    },
    sendMessageToManagersFromEmail(b) {
        const chat = chats.manager;
        const message = this.formatEmailMessage(b);
        return bot.sendMessage(chat, message).then(()=>{
            console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
        }).catch(e => {
            console.log(e);
        });
    },
    resendEmailToChat(b, chat, message = null, options = {}) {
        if(!message)
            message = this.formatEmailMessage(b);
        return bot.sendMessage(chat, message, options).then((msg)=>{
            console.log(`сообщение (id: ${msg.message_id})${message} успешно отправлено в чат (${chat})`);
            return msg;
        }).catch(e => {
            console.log(e);
        });
    },
    resendEmailToChatAsHTML(b, chat) {
        const message = this.formatEmailMessage(b);
        const shortMessage = shortenMessage(message);
        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: '📤 Показать целиком', callback_data: 'open' }],
                ]
            }),
            disable_web_page_preview: true,
        };
        return this.resendEmailToChat(b, chat, shortMessage, options)
            .then(msg => {
                gApi.addRow(msg.chat.id, msg.message_id, message)
                    .then(() => console.log('сообщение записано в таблицу'))
            })
            .catch(e => {
                console.log(e);
            });
    },
    async toggleOpenCloseMessage(bot, chat_id, message_id, action_type){
        const button = action_type === 'open' ? { text: '📥 Скрыть', callback_data: 'close' } : { text: '📤 Показать целиком', callback_data: 'open' };
        const messages = await gApi.getMessages();
        const message = action_type === 'open' ? shortenMessage(messages[chat_id][message_id], 4000) : shortenMessage(messages[chat_id][message_id]);
        return bot.editMessageText(message, {
            chat_id,
            message_id,
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [button],
                ]
            }),
            disable_web_page_preview: true,
        });
    },
    async checkMissedCalls(msg = null, days = 1){
        let chat_id = msg ? msg.chat.id : chats.manager;
        const message = await menu.missed(days);
        return bot.sendMessage(chat_id, message).then((msg)=>{
            console.log(`сообщение (id: ${msg.message_id})${message} успешно отправлено в чат (${chat_id})`);
            return msg;
        }).catch(e => {
            console.log(e);
        });
    },
};

bot.on('callback_query', function (msg) {
    methods.toggleOpenCloseMessage(bot, msg.message.chat.id, msg.message.message_id, msg.data)
        .then(()=>{
            console.log(`Сообщение успешно отредактировано (${msg.data})`);
        }).catch(e => {
        console.log(e);
});
});

bot.onText(/\/start/, async (msg) => {
    try{
        await bot.sendMessage(msg.chat.id, menu.hello);
    }catch (e) {
        console.log(e)
    }
});

bot.onText(/\/orders/, async (msg) => {
    try{
        await bot.sendMessage(msg.chat.id, menu.orders);
    }catch (e) {
        console.log(e)
    }
});

bot.onText(/\/misseddays (.+)/, async (msg, match) => {
    try{
        console.log('/misseddays');
        console.log(match);
        const days = match[1] ? match[1] : 1;
        await methods.checkMissedCalls(msg, days);
    }catch (e) {
        console.log(e)
    }
});

bot.onText(/\/missed/, async (msg) => {
    try{
        console.log('/missed');
        await methods.checkMissedCalls(msg);
    }catch (e) {
        console.log(e)
    }
});

// methods.checkMissedCalls().catch(e => console.log(e));
setInterval(async ()=>{
    if(moment().format('HH') > 9 && moment().format('HH') < 20){
        await methods.checkMissedCalls();
    }
}, 60 * 60 * 1000);

module.exports = methods;
