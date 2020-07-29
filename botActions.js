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
        console.log(b);
        const message = `письмо от ${b.from.value[0].name} <${b.from.value[0].address}> (${moment(b.date).format('DD.MM.YYYY HH:mm:ss')})\nтема письма: ${b.subject}\n---------------------\n${b.text}`;
        // console.log(message);
        return bot.sendMessage(chat, message).then(()=>{
            console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
        }).catch(e => {
            console.log(e);
        });
    },
};
