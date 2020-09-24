const moment = require('moment');
const API = require('../analytics/data-manager.js');
const axios = require('axios');
const icons = require('./numberIcons.js');

class Button {
    constructor(text, cb) {
        this.btn = { text: text, callback_data: cb }
    }
}

class Menu{
    constructor() {
        this.year = moment().format('YYYY');
        this.month = moment().format('MM')
    }

    async renderMissedCalls(days){
        const data = await API.getMissedCalls(days);
        // console.log(data);
        let message = 'Список пропущенных вызовов: \n ---------\n';
        const menu = [];
        // console.log(data);

        data.data.map(item => {
            const orderNum = `${item.order_number ? ' | ' + item.order_number : ''}`;
            const clientName = `${item.client_name ? ' | ' + item.client_name : ''}`;
            const missedAt = moment(item.missed_at).format('DD.MM HH:mm');
            console.log(toString(item.nedozvon_cnt));
            const tryCount = icons[toString(item.nedozvon_cnt)] ? icons[toString(item.nedozvon_cnt)] : item.nedozvon_cnt;
            message += `☎️ ${item.client} | ${missedAt} ⤴️${tryCount}  | ${item.line_number}${orderNum}${clientName} \n`;
            menu.push(new Button(item.client_name, 'some cb'))
        });
        let options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    menu,
                ]
            }),
            // disable_web_page_preview: true,
        };
        if(!data.data.length)
            message = 'Нет пропущенных вызовов';
        return message;
    }
}

const menu = new Menu();

const messages ={
    hello:
    `
    Привет 👋, я VI (Сокращенно от Vkostume Informer)
    Я умею показывать статистику:
    /orders - по заказам
    /expenses - расходу
    /calls - по звонкам 
    /managers - по менеджерам
    /missed - по пропущенным звонкам
    `,
    orders: `orders message`,
    missed: menu.renderMissedCalls,
};




module.exports = messages;
