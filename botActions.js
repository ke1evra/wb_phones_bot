const bots = require('./bot.js');
const chats = require('./chatList.js');
const moment = require('moment');
const htmlToText = require('html-to-text');
const gApi = require('./googleApi/googleApiManager.js');


module.exports = {
    sendMessageFromZebra(b) {
        const bot = bots.wb_phones;
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
            wordwrap: false
        });
        if (typeof text === 'string' && text.indexOf('info@vkostume.ru') !== -1){
            text = text.split('info@vkostume.ru')[0];
        }
        return `${b.from.value[0].name} <${b.from.value[0].address}> (${moment(b.date).format('DD.MM.YYYY HH:mm:ss')})\n${b.subject}\n---------------------\n${text}`;
    },
    sendMessageToManagersFromEmail(b) {
        const bot = bots.vkostume_informer;
        const chat = chats.manager;
        const message = formatEmailMessage(b);
        return bot.sendMessage(chat, message).then(()=>{
            console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
        }).catch(e => {
            console.log(e);
        });
    },
    resendEmailToChat(b, chat, message = null, options = {}) {
        const bot = bots.vkostume_informer;
        if(!message)
            message = formatEmailMessage(b);
        return bot.sendMessage(chat, message, options).then((msg)=>{
            console.log(`сообщение (id: ${msg.message_id})${message} успешно отправлено в чат (${chat})`);
            return msg;
        }).catch(e => {
            console.log(e);
        });
    },
    resendEmailToChatAsHTML(b, chat) {
        const message = formatEmailMessage(b);
        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: 'Кнопка 1', callback_data: '1' },{ text: 'Кнопка 5', callback_data: '1' }],
                    [{ text: 'Кнопка 2', callback_data: 'data 2' }],
                    [{ text: 'Кнопка 3', callback_data: 'text 3' }]
                ]
            })
        };
        this.resendEmailToChat(b, chat, message, options)
            .then(msg => {
                gApi.addRow(msg.chat.id, msg.message_id, msg.text)
                    .then(() => console.log('сообщение записано в таблицу'))
            })
            .catch(e => {
                console.log(e);
            });
    },
};
