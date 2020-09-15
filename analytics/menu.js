const moment = require('moment');
const API = require('../analytics/data-manager.js');
const axios = require('axios');

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

    async renderMissedCalls(){
        const data = await API.getMissedCalls();
        let message = 'Список пропущенных вызовов: \n';
        const menu = [];
        // console.log(data);
        data.data.map(item => {
            message += `${item.client}${item.order_number ? ' | ' + item.order_number : ''}${item.client_name ? ' | ' + item.client_name : ''}`;
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
