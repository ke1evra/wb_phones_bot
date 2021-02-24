const moment = require('moment');
const API = require('../analytics/data-manager.js');
const axios = require('axios');
const icons = require('./numberIcons.js');
const codes = require('../constants/disconnect-reasons-codes');

class Button {
    constructor(text, cb) {
        this.btn = {text: text, callback_data: cb}
    }
}

class Menu {
    constructor() {
        this.year = moment().format('YYYY');
        this.month = moment().format('MM')
    }

    async renderMissedCalls(days) {
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
        if (!data.data.length)
            message = 'Нет пропущенных вызовов';
        return message;
    }
    ///Функция которая возвращает ProcessBar. "title"-Строка заголовка. "value"- процент(число от 0 до 1)
    renderPercentage(title="",value=0){
        try {
            if(value>1 ||value<0)
            {
                console.log(`Ошибка в функции renderPercentage: Значение "value"=${value} выходит за рамки от 0 до 1!`)
                return "ERROR";
            }
            let msg=`${title} (${(value*100).toFixed(2)}%)\n`;
            for(let i=0;i<value;i+=0.05)
                msg+='🟩';
            for(let i=1-value;i>0;i-=0.05)
                msg+='⬜️';
            return msg;
        }catch (e) {
            console.log(`Ошибка в функции renderPercentage: ${e}`);
            return "ERROR";
        }
    }
    async renderExpenses(days) {
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
        if (!data.data.length)
            message = 'Нет расходов';
        return message;
    }

    async renderManagers(days) {
        const data = await API.getManagers(days);
        // console.log(data);
        let message = 'Менеджеры:\n';
        const menu = [];
        //console.log(data.data["data1"]);

        data.data["data1"].map((item, index) => {
            message += `${index + 1}. ${item.call_type === 'inComing' ? `Входящий` : 'Исходящий'} вызов на номер ${item.to_number} (${item.person}) с номера ${item.from_number}\n${item.startFix} - ${item.endFix} (${item["start"]} - ${item["end"]})\nПричина окончания: ${codes[item.disconnect_reason]} (${item.disconnect_reason})\n---------------------------\n`;
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
        if (!data.data["data1"].length)
            message = 'Нет данных';
        return message;
    }

    async renderOrders(days) {
        try{
            let from = moment().subtract(days, "days").format("YYYY-MM-DD");
            let to = moment().endOf("day").format("YYYY-MM-DD")
            const data = await API.getOrdersCount(days);
            let message = `Счётчик по заказам с ${from} по ${to}: \n ---------------------------\n`;
            // console.log(data);
            //Объявление переменных
            let orderTotalSum=0;
            let orderTotalCount=0;
            data.data.forEach((item)=>{
                orderTotalCount++;
                orderTotalSum+=item.order_sum;
            });
            message+=`Всего заказов поступило ${orderTotalCount} на сумму ${orderTotalSum}, из них:\n`
            data.data.map((item, index) => {
                message+=`${item.order_count} - `;
                message+=menu.renderPercentage(item.order_status,item.order_count/orderTotalCount);
                message+='\n';
            });
            if (!data.data.length)
                message = `Нет заказов за период с ${from} по ${to}.`;
            return message;
        }catch (e) {
            console.log(`Ошибка в функции renderOrders:${e}`);
            return "";
        }

    }

    async renderCalls(days) {
        let from = moment().subtract(days, "days").format("YYYY-MM-DD");
        let to = moment().endOf("day").format("YYYY-MM-DD")
        const data = await API.getCalls(days);
        let message = 'Статистика по звонкам: \n ---------------------------\n';
        let statistics = [];
        // console.log(data);
        statistics['calls_count'] = 0
        statistics['calls_duration'] = 0;
        statistics['real_calls_count'] = 0;
        statistics['line_numbers'] = {};
        statistics['disconnect_reasons'] = {}
        statistics['disconnect_reasons']['total'] = {};
        statistics['disconnect_reasons']['Входящий'] = {};
        statistics['disconnect_reasons']['Исходящий'] = {};
        statistics['disconnect_reasons']['Недозвон'] = {};
        statistics['disconnect_reasons']['Пропущенный'] = {};

        statistics['Входящий'] = {};
        statistics['Входящий']['calls_duration'] = 0;
        statistics['Входящий']['calls_count'] = 0;
        statistics['Входящий']['time_before_answer'] = 0;

        statistics['Исходящий'] = {};
        statistics['Исходящий']['calls_duration'] = 0;
        statistics['Исходящий']['calls_count'] = 0;
        statistics['Исходящий']['time_before_answer'] = 0;

        statistics['Недозвон'] = {};
        statistics['Недозвон']['calls_duration'] = 0;
        statistics['Недозвон']['calls_count'] = 0;
        statistics['Недозвон']['time_before_finish'] = 0;

        statistics['Пропущенный'] = {};
        statistics['Пропущенный']['calls_duration'] = 0;
        statistics['Пропущенный']['calls_count'] = 0;
        statistics['Пропущенный']['time_before_finish'] = 0;

        data.data.forEach((call) => {
            statistics['calls_count']++;
            if (call.call_duration !== '') {
                statistics['calls_duration'] += parseFloat(call.call_duration);
                statistics['real_calls_count']++;
            }
            if (statistics['disconnect_reasons']['total'].hasOwnProperty(call.disconnect_reason))
                statistics['disconnect_reasons']['total'][call.disconnect_reason]++;
            else
                statistics['disconnect_reasons']['total'][call.disconnect_reason] = 1;
            //line_numbers
            if (statistics['line_numbers'].hasOwnProperty(call.line_number))
                statistics['line_numbers'][call.line_number]++;
            else
                statistics['line_numbers'][call.line_number] = 1;
            switch (call.call_type) {
                case 'Входящий':
                    statistics['Входящий']['calls_count']++;
                    statistics['Входящий']['calls_duration'] += parseFloat(call.call_duration);
                    statistics['Входящий']['time_before_answer'] += parseFloat(call.answer_time);
                    //Причины дисконнекта
                    if (statistics['disconnect_reasons']['Входящий'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Входящий'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Входящий'][call.disconnect_reason] = 1;
                    break;
                case 'Исходящий':
                    statistics['Исходящий']['calls_count']++;
                    statistics['Исходящий']['calls_duration'] += parseFloat(call.call_duration);
                    statistics['Исходящий']['time_before_answer'] += parseFloat(call.answer_time);
                    //Причины дисконнекта
                    if (statistics['disconnect_reasons']['Исходящий'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Исходящий'][call.disconnect_reason] = 1;
                    break;
                case 'Недозвон':
                    statistics['Недозвон']['calls_count']++;
                    statistics['Недозвон']['time_before_finish'] += call.finish - call.start;
                    //Причины дисконнекта
                    if (statistics['disconnect_reasons']['Недозвон'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Недозвон'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Недозвон'][call.disconnect_reason] = 1;
                    break;
                case 'Пропущенный':
                    statistics['Пропущенный']['calls_count']++;
                    statistics['Пропущенный']['time_before_finish'] += parseFloat(call.finish) - parseFloat(call.start);
                    //Причины дисконнекта
                    if (statistics['disconnect_reasons']['Пропущенный'].hasOwnProperty(call.disconnect_reason))
                        statistics['disconnect_reasons']['Пропущенный'][call.disconnect_reason]++;
                    else
                        statistics['disconnect_reasons']['Пропущенный'][call.disconnect_reason] = 1;
                    break;
                default:
                    break;
            }
        });
        //формирование сообщения
        message += `За период с ${from} по ${to} было совершено: ${statistics.calls_count} звонков,
Общей длительностью ${statistics.calls_duration} секунд, 
Средней продолжительностью: ${(statistics.calls_duration / statistics.real_calls_count).toFixed(2)} секунд.
------------------------
Статистика по причинам окончаниям звонка:`;
        for (let reason in statistics.disconnect_reasons.total) {
            message += `\n    ${codes[reason]}: ${statistics.disconnect_reasons.total[reason]},`
        }
        message += '\nСтатистика по типам звонков:';
        let call_types = ['Входящий', 'Исходящий', 'Недозвон', 'Пропущенный'];
        for (let i in call_types) {
            message += `\n${call_types[i]}:`;
            message += `\n    Число звонков: ${statistics[call_types[i]].calls_count},`;
            if (['Входящий', 'Исходящий'].includes(call_types[i])) {
                message += `\n    Суммарная длительность: ${statistics[call_types[i]].calls_duration} с`;
                message += `\n    Средняя длительность: ${(statistics[call_types[i]].calls_duration / statistics[call_types[i]].calls_count).toFixed(2)} с`;
                message += `\n    Среднее время до ответа: ${(statistics[call_types[i]].time_before_answer / statistics[call_types[i]].calls_count).toFixed(2)} с`;
            } else
                message += `\n    Среднее время до сброса звонка: ${(statistics[call_types[i]].time_before_finish / statistics[call_types[i]].calls_count).toFixed(2)} с`;
            message += `\n   По причинам окончания:`;
            for (let reason in statistics.disconnect_reasons[call_types[i]]) {
                message += `\n     ${codes[reason]}: ${statistics.disconnect_reasons[call_types[i]][reason]}`;
            }
        }
        if (!data.data.length)
            message = 'Нет данных по звонкам за период.';
        return message;
    }
}

const menu = new Menu();

const messages = {
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
    calls: menu.renderCalls,
    expenses: menu.renderExpenses,
    managers: menu.renderManagers
};


module.exports = messages;
