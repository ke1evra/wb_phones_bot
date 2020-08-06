const bots = require('./bot.js');
const chats = require('./chatList.js');
const moment = require('moment');



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
    sendMessageToManagersFromEmail(b) {
        const bot = bots.vkostume_informer;
        const chat = chats.manager;
        let text = b.text;
        if (typeof text === 'string' && text.indexOf('info@vkostume.ru') !== -1){
            text = b.text.split('<info@vkostume.ru')[0];
        }
        // console.log(b);
        const message = `${b.from.value[0].name} <${b.from.value[0].address}> (${moment(b.date).format('DD.MM.YYYY HH:mm:ss')})\n${b.subject}\n---------------------\n${text}`;
        // console.log(message);
        return bot.sendMessage(chat, message).then(()=>{
            console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
        }).catch(e => {
            console.log(e);
        });
    },
    resendEmailToChat(b, chat, message = null) {
        const bot = bots.vkostume_informer;
        if(!message)
            message = `${b.from.value[0].name} <${b.from.value[0].address}> (${moment(b.date).format('DD.MM.YYYY HH:mm:ss')})\n${b.subject}\n---------------------\n${b.text}`;
        return bot.sendMessage(chat, message).then(()=>{
            bot.sendMessage(chat, b).then();
            console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
        }).catch(e => {
            console.log(e);
        });
    },
    resendEmailToChatAsHTML(b, chat) {
        this.resendEmailToChat(b, chat, b);
    },
};
