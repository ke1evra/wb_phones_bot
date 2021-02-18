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
        let message = 'Список пропущенных вызовов: \n ---------------------------\n';
        const menu = [];
        // console.log(data);

        data.data.map((item, index) => {
            const orderNum = `${item.order_number ? '\nНомер заказа: ' + item.order_number : ''}`;
            const clientName = `${item.client_name ? ' | ' + item.client_name : ''}`;
            const missedAt = moment(item.missed_at).format('DD.MM HH:mm');
            message += `${index + 1}. ${item.client} ( ${missedAt} )\nПопыток дозвона: ${item.nedozvon_cnt}\nЛиния: ${item.line_number}${orderNum}${clientName} \n---------------------------\n`;
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
    async renderExpenses(days){
        const data = await API.getExpenses(days);
        // console.log(data);
        let message = 'Список расходов: \n ---------------------------\n';
        const menu = [];
        // console.log(data);

        data.data.map((item, index) => {
            message += `${index + 1}. (${item.date})\nЯндекс.Маркет: ${item.yandexmarket}\nЯндекс.Директ: ${item.yandexdirect}\nGoogle Ads: ${item.googleads}\nВсего: ${item['total']} \n---------------------------\n`;
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
            message = 'Нет расходов';
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
    expenses: menu.renderExpenses
};




module.exports = messages;
