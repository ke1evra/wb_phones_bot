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

    async renderOrders(days)
    {
        const data = await API.getOrdersCount(days);
        let message='Счётчик по заказам: \n ---------------------------\n';
        const menu = [];
        // console.log(data);

        data.data.map((item, index) => {
            const status = `${item.order_status ? 'Статус: ' + item.order_status +',\n' : ''}`;
            const orderSum = `${item.order_sum ? ' Общая сумма заказов: ' + item.order_sum + '.\n' : ''}`;
            const orderCount = `${item.order_count ? 'Количество заказов: ' + item.order_count+',\n' : ''}`;
            message += `${index + 1}. ${status}${orderCount}${orderSum}--------------------------\n`;
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
            message = 'Нет заказов за период.';
        return message;
    }
    async renderCalls(days)
    {
        const data = await API.getCalls(days);
        let message='Статистика по звонкам: \n ---------------------------\n';
        var statistics=[];
        // console.log(data);
        statistics['calls_count']=0
        statistics['calls_duration']=0;
        statistics['line_numbers']={};
        statistics['disconnect_reasons']={}
        statistics['disconnect_reasons']['total']={};
        statistics['disconnect_reasons']['Входящий']={};
        statistics['disconnect_reasons']['Исходящий']={};
        statistics['disconnect_reasons']['Недозвон']={};
        statistics['disconnect_reasons']['Пропущенный']={};

        statistics['Входящий']={};
        statistics['Входящий']['calls_duration']=0;
        statistics['Входящий']['calls_count']=0;
        statistics['Входящий']['time_before_answer']=0;

        statistics['Исходящий']={};
        statistics['Исходящий']['calls_duration']=0;
        statistics['Исходящий']['calls_count']=0;
        statistics['Исходящий']['time_before_answer']=0;

        statistics['Недозвон']={};
        statistics['Недозвон']['calls_duration']=0;
        statistics['Недозвон']['calls_count']=0;
        statistics['Недозвон']['time_before_finish']=0;

        statistics['Пропущенный']={};
        statistics['Пропущенный']['calls_duration']=0;
        statistics['Пропущенный']['calls_count']=0;
        statistics['Пропущенный']['time_before_finish']=0;

        data.data.forEach((call) => {
            statistics['calls_count']++;
            statistics['calls_duration']+=call.call_duration===''?0:parseFloat(call.call_duration);
            if(statistics['disconnect_reasons']['total'].hasOwnProperty(call.disconnect_reason))
                statistics['disconnect_reasons']['total'][call.disconnect_reason]++;
            else
                statistics['disconnect_reasons']['total'][call.disconnect_reason]=1;
            //line_numbers
            if(statistics['line_numbers'].hasOwnProperty(call.line_number))
                statistics['line_numbers'][call.line_number]++;
            else
                statistics['line_numbers'][call.line_number]=1;
            switch (call.call_type) {
                case 'Входящий':
                    statistics['Входящий']['calls_count']++;
                    statistics['Входящий']['calls_duration']+=parseFloat(call.call_duration);
                    statistics['Входящий']['time_before_answer']+=parseFloat(call.answer_time);
                    //Причины дисконнекта
                    if(statistics['disconnect_reasons']['Входящий'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Входящий'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Входящий'][call.disconnect_reason]=1;
                    break;
                case 'Исходящий':
                    statistics['Исходящий']['calls_count']++;
                    statistics['Исходящий']['calls_duration']+=parseFloat(call.call_duration);
                    statistics['Исходящий']['time_before_answer']+=parseFloat(call.answer_time);
                    //Причины дисконнекта
                    if(statistics['disconnect_reasons']['Исходящий'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]=1;
                    break;
                case 'Недозвон':
                    statistics['Недозвон']['calls_count']++;
                    statistics['Недозвон']['time_before_finish']+=call.finish-call.start;
                    //Причины дисконнекта
                    if(statistics['disconnect_reasons']['Исходящий'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]=1;
                    break;
                case 'Пропущенный':
                    statistics['Пропущенный']['calls_count']++;
                    statistics['Пропущенный']['time_before_finish']+=parseFloat(call.finish)-parseFloat(call.start);
                    //Причины дисконнекта
                    if(statistics['disconnect_reasons']['Исходящий'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]=1;
                    break;
                default: break;
            }
        });
        //формирование сообщения
        message+=`За период было совершено: ${statistics.calls_count} звонков,
        \nОбщей длительностью ${statistics.calls_duration}, 
        \nСредней продолжительностью: ${(statistics.calls_duration/statistics.calls_count).toFixed(2)} секунд.
        \n--------------------
        \nСтатистика по причинам окончаниям звонка:`;
        for(let reason in statistics.disconnect_reasons.total){
           message+=`\n  ${reason}: ${statistics.disconnect_reasons.total[reason]},`
        }
        message+='\nСтатистика по типам звонков:';
        console.log(`Общий этам по звонкам пройден ${message}`);
        for(let call_type in['Входящий','Исходящий','Недозвон','Пропущенный'])
        {
            message+=`${call_type}:
            \n    Число звонков: ${statistics[call_type].calls_count},
            \n    Суммарная длительность: ${statistics[call_type].calls_duration} секунд,
            \n    Средняя длительность: ${statistics[call_type].calls_duration/statistics[call_type].calls_count},
            ${statistics[call_type].hasOwnProperty("time_before_finish")?
                `\n    Среднее время до сброса звонка: ${statistics[call_type].time_before_finish/statistics[call_type].calls_count} секунд`:''}
            ${statistics[call_type].hasOwnProperty("time_before_answer")?
                `\n    Среднее время до сброса звонка: ${statistics[call_type].time_before_answer/statistics[call_type].calls_count} секунд`:''}
            \n    По причинам окончания:`;
            for(let reason in statistics.disconnect_reasons[call_type]){
                message+=`\n     ${reason}: ${statistics.disconnect_reasons[call_type][reason]}`;
            }

        }
        console.log(`Сообщение в renderCalls: ${message}`);
        if(!data.data.length)
            message = 'Нет данных по звонкам за период.';
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
    orders: menu.renderOrders,
    missed: menu.renderMissedCalls,
    calls:menu.renderCalls,
    expenses: menu.renderExpenses
};




module.exports = messages;
