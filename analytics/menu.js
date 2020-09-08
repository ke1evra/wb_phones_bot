const moment = require('moment');

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
    orders: `orders message`
};

class Menu{
    constructor() {
        this.year = moment().format('YYYY');
        this.month = moment().format('MM')
    }

}

module.exports = messages;
