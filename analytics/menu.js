let TimeFormat = require('hh-mm-ss');
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

    async renderMissedCalls(fields) {
        //Фильтр на тип запроса
        let request_type = '';
        if (['days', 'day', 'range'].includes(fields.request_type))
            request_type = fields.request_type;
        else
            request_type = 'days'
        //Начало обработки передаваемых параметра
        if (typeof fields.days == "undefined" || fields.days == null)
            fields.days = 0;
        if (request_type === 'day') {
            fields.to = fields.from;
            request_type = 'days';
        }
        let from = typeof fields.from == "undefined" || fields.from == null ? moment().subtract(fields.days, "days").format("YYYY-MM-DD") : fields.from;
        let to = typeof fields.to == "undefined" || fields.to == null ? moment() : moment(fields.to);
        //т.к. берёт не включительно добавляем +1 день
        to.add(1, "day");
        //Получение данных
        //console.log(from,to,fields.days);
        const data = await API.getMissedCalls(fields.days,from,to.format("YYYY-MM-DD"));
        //Возвращаем день назад и преобразуем в строку
        to = to.add(-1, "day").format("YYYY-MM-DD");
        // console.log(data);
        let message = 'Список пропущенных вызовов ';
        message+=request_type==='days'?
            fields.days>0?`с ${from} по ${to}`:`на ${from}`
            :`с ${from} по ${to}`;
        message+=':\n---------------------------\n';
        const menu = [];
        // console.log(data);
        if (!data.data.length)
        {
            message = 'Нет пропущенных вызовов';
            return message;
        }
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
        return message;
    }

    async renderExpenses(fields) {
        if (typeof fields.days == "undefined" || fields.days == null)
            fields.days = 1;
        const data = await API.getExpenses(fields.days);
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

    async renderManagers(fields) {
        if (typeof fields.days == "undefined" || fields.days == null)
            fields.days = 1;
        if (!fields.days) fields.days++
        const data = await API.getManagers(fields.days);
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

    async renderOrderByNumber(fields) {
        const itemStatusIcons = require('../constants/ItemStatusIcons')
        const orderStatusIcons = require('../constants/OrderStatusIcons')
        const callTypeIcons = require('../constants/CallTypeIcons')
        console.log("fields=", fields)
        const data = await API.getOrderByNumber(fields.order_number);
        // console.log(data);
        let message = "";
        const menu = [];
        //console.log(data.data["data1"]);
        console.log(data)
        data.data.map((item, index) => {
            message += `Заказ ${item.id}\n-------------------------\n\n` +
                `Cтатус: ${orderStatusIcons[item.status]} ${item.status}\n` +
                `Поступил: ${moment(item.date_of_registration).format("YYYY-MM-DD HH:mm:ss")}, обработан через ${item.processing_time}\n` +
                `Менеджер: ${item.manager}\n\n-------------------------\nКлиент:\n\n` +
                `${item.client_name}\n` +
                `${item.phone_key}${item.client_dop_phone ? ` (${item.client_dop_phone})` : ``}\n` +
                `${item.email}\n-------------------------\nСостав:\n\n` +
                (() => {
                    item.items = item.items.split('&').map(item => {
                        item = item.split('|')
                        item = `${parseInt(item[1])} ₽ — ${item[0]} ${itemStatusIcons[item[2]]} ${item[2]}`
                        return item
                    })
                    return item.items.join('\n') + "\n\n"
                })() +
                `${item.delivery_price} ₽ — Доставка\n\n` +
                `${item.order_sum} ₽ — Стоимость заказа\n-------------------------\nДоставка:\n\n` +
                `${item.address}\n${item.courier_del_id}, ${item.courier}\n-------------------------\nДействия:\n\n` +
                (() => {
                    item.actions = item.actions.split('&').map(item => {
                        item = item.split('|')
                        item = `${item[1]} — ${item[0]}\n${item[2]}`
                        return item
                    })
                    return item.actions.join('\n\n') + '\n-------------------------'
                })()
            menu.push(new Button(item.client_name, 'some cb'))
        });
        const callsLog = await API.getCallsLogByPhoneNumber(data.data[0].phone_key);
        console.log(callsLog)
        if (callsLog.data) {
            message += `\nЗвонки:\n`
            callsLog.data.map((item, index) => {
                message += `\n----------\n${index + 1}. ${item.start_day} ${item.start_time} ${callTypeIcons[item.call_type]} ${item.call_type} ${item.line_number ?` (${item.line_number})`: ``}\n\n` +
                    `👤 ${item.person}\n` +
                    (()=>{
                        let result
                        switch (item.call_type){
                            case "Входящий":
                                result=`➡️${item.start_time} — 🕑${item.answer_type} → 🗣${moment.unix(item.answer).format("HH:mm:ss")} — 🕑${item.call_duration} → 🏁${moment.unix(item["finish"]).format("HH:mm:ss")}`
                                break;
                            case "Исходящий":
                                result=`➡️${item.start_time} — 🕑${item.answer_type} → 🗣${moment.unix(item.answer).format("HH:mm:ss")} — 🕑${item.call_duration} → 🏁${moment.unix(item["finish"]).format("HH:mm:ss")}`
                                break;
                            case "Пропущенный":
                                result=`➡️${item.start_time} — 🕑${moment(moment.unix(item["finish"]).format("HH:mm:ss"),"HH:mm:ss").diff(moment(item.start_time,"HH:mm:ss"),"seconds")} → 🏁${moment.unix(item["finish"]).format("HH:mm:ss")}`
                                break;
                            case "Недозвон":
                                result=`➡️${item.start_time} — 🕑${moment(moment.unix(item["finish"]).format("HH:mm:ss"),"HH:mm:ss").diff(moment(item.start_time,"HH:mm:ss"),"seconds")} → 🏁${moment.unix(item["finish"]).format("HH:mm:ss")}`
                                break;
                        }
                    })()
                    `${codes[item.disconnect_reason]} (${item.disconnect_reason})\n`
            })
            message += "-------------------------"
        }
        let options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    menu,
                ]
            }),
            // disable_web_page_preview: true,
        };
        if (!data.data.length)
            message = 'Нет данных';
        return message;
    }

    ///Функция которая возвращает ProcessBar. "title"-Строка заголовка. "value"- процент(число от 0 до 1)
    renderPercentage(title = "", value = 0) {
        try {
            if (value > 1 || value < 0) {
                console.log(`Ошибка в функции renderPercentage: Значение "value"=${value} выходит за рамки от 0 до 1!`)
                return "ERROR";
            }
            let msg = `${title} (${(value * 100).toFixed(2)}%)\n`;
            let counter = 1;
            while (value > 0.05) {
                msg += '🟩';
                counter++;
                value -= 0.05;
            }
            if (value.toFixed(4) != 0)
                msg += value >= 0.025 ? '🟢' : '⚪️';
            else
                msg += '⬜️';
            for (counter; counter < 20; counter++)
                msg += '⬜️';
            return msg;
        } catch (e) {
            console.log(`Ошибка в функции renderPercentage: ${e}`);
            return "ERROR";
        }
    }

    ///для сортировки массивов в renderOrders формата arr=[[elem1,count],[elem2,count]]
    sortOrdersArrays(arr) {
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                if (arr[i][1] < arr[j][1]) {
                    let a = arr[i];
                    arr[i] = arr[j];
                    arr[j] = a;
                }
            }
        }
    }

    ///для отформатированных массивов в renderOrders формата arr=[[elem1,count],[elem2,count]]
    searchPushOrdersArrays(elem, arr) {
        let found = false;
        for (let i = 0; i < arr.length; i++) {
            if (arr[i][0] === elem) {
                found = true;
                arr[i][1]++;
                break;
            }
        }
        if (!found) arr.push([elem, 1]);
    }

    numberWithCommas(x, text) {
        const value = x.value ? x.value : x;
        const formatted = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return text ? `${text} ${formatted}` : formatted;
    }

    formatSecondsAsHHMMSS(number, text) {
        if (!text) {
            text = '';
        } else {
            text = `${text}: `;
        }
        let format = 'hh:mm:ss';
        if (number > 3600) {
            format = 'hh:mm:ss';
        } else {
            format = 'mm:ss';
        }
        let returnString = '';
        if (number > 0) {
            returnString = `${text}${TimeFormat.fromS(Math.round(number), format)}`;
        }
        return returnString;
    }

    async renderOrders(fields) {
        try {
            let request_type = fields.request_type;
            if (request_type === 'range' && fields.to < fields.from) {
                let a = fields.from;
                fields.from = fields.to;
                fields.to = a;
            }
            if (request_type === 'day') {
                fields.to = fields.from;
                //Далее всё будет как в запросе days=0
                request_type = 'days';
            }
            if (request_type === 'number') {

            }
            fields.from = fields.from == null || typeof fields.from == "undefined" ? moment().subtract(fields.days, "days").format("YYYY-MM-DD") : fields.from;
            fields.to = fields.to == null || typeof fields.to == "undefined" ? moment() : moment(fields.to);
            //т.к. берёт не включительно добавляем +1 день
            fields.to.add(1, "day");
            //По типам заказов
            const ordersCountData = await API.getOrdersCount(fields.days, fields.from, fields.to.format("YYYY-MM-DD"));
            let orderTotalSum = 0;
            let orderTotalCount = 0;
            let ordersTypesCount = [];
            ordersCountData.data.forEach((item) => {
                orderTotalCount += item.order_count;
                orderTotalSum += item.order_sum;
                ordersTypesCount.push([item.order_status, item.order_count]);
            });
            //По конкретным заказам
            const ordersData = await API.getOrders(fields.days, fields.from, fields.to.format("YYYY-MM-DD"));
            //После запроса возвращаем "to" как было
            fields.to = fields.to.add(-1, "day").format("YYYY-MM-DD");
            let otkaz_reasons = [];
            let otkaz_count = 0;
            let samovivoz = 0;
            let proceed_time = 0;
            let proceed_count = 0;
            let managers = [];
            let couriers = [];
            let cities = [];
            ordersData.data.forEach((item) => {
                //Преобразование затраченного времени
                if (item.proceed_time != null && item.proceed_time > 0) {
                    //let created_at=moment(item.created_at.substr(0,19).replace('T',' ')).format('YYYY-MM-DD HH:mm:ss');
                    if (moment(item.created_at).format('HH') > 9 && moment(item.created_at).format('HH') < 20) {
                        proceed_time += parseInt(item.proceed_time);
                        proceed_count++;
                    }
                }
                //Счёт по типам
                if (item.order_status_title === "Отказ" && item.otkaz_title !== null) {
                    otkaz_count++;
                    menu.searchPushOrdersArrays(item.otkaz_title, otkaz_reasons);
                }
                samovivoz += item.samovivoz == "нет" ? 0 : 1;
                if (item.name != null)
                    menu.searchPushOrdersArrays(item.name, managers);
                if (item.courier !== null)
                    menu.searchPushOrdersArrays(item.courier, couriers);
                if (item.city !== null)
                    menu.searchPushOrdersArrays(item.city, cities);
            });
            //Сортировка
            menu.sortOrdersArrays(managers);
            menu.sortOrdersArrays(couriers);
            menu.sortOrdersArrays(cities);
            menu.sortOrdersArrays(otkaz_reasons);
            menu.sortOrdersArrays(ordersTypesCount);
            //rework cities
            let other_cities = 0;
            for (let i = 5; i < cities.length; i++)
                other_cities += cities[i][1];
            //Начало составления сообщения
            let message = request_type === 'days' ?
                `Статистика по заказам ${fields.days > 0 ? `с ${fields.from}` : `на ${fields.from}`}`
                : `Статистика по заказам на период с ${fields.from} по ${fields.to}`;
            message += `:\n ---------------------------\n`;

            message += `Всего заказов поступило ${menu.numberWithCommas(orderTotalCount)} на сумму ${menu.numberWithCommas(orderTotalSum)}.${proceed_time > 0 ? ` Среднее время обработки заказов - ${menu.formatSecondsAsHHMMSS((proceed_time / proceed_count).toFixed())}` : ''}, из них:\n`
            for (let i = 0; i < ordersTypesCount.length; i++) {
                message += `\n${ordersTypesCount[i][1]} - `;
                message += menu.renderPercentage(ordersTypesCount[i][0], ordersTypesCount[i][1] / orderTotalCount);
                message += '\n';
            }
            message += `----------------------\nСтатистика по причинам отказов\nВсего отказов ${otkaz_count}, из них:\n`;
            for (let i = 0; i < otkaz_reasons.length; i++) {
                message += `\n${otkaz_reasons[i][1]} - `;
                message += menu.renderPercentage(otkaz_reasons[i][0], otkaz_reasons[i][1] / otkaz_count);
                message += '\n';
            }
            message += `----------------------\nСтатистика по менджерам:\n`;
            for (let i = 0; i < managers.length; i++) {
                message += `\n${managers[i][1]} - `;
                message += menu.renderPercentage(managers[i][0], managers[i][1] / orderTotalCount);
                message += '\n';
            }
            message += `----------------------\nСтатистика по курьерам:\n`;
            for (let i = 0; i < couriers.length; i++) {
                message += `\n${couriers[i][1]} - `;
                message += menu.renderPercentage(couriers[i][0], couriers[i][1] / orderTotalCount);
                message += '\n';
            }
            message += `----------------------\nСтатистика по городам:\n`;
            for (let i = 0; i < 5; i++) {
                message += `\n${cities[i][1]} - `;
                message += menu.renderPercentage(cities[i][0], cities[i][1] / orderTotalCount);
                message += '\n';
            }
            message += `\n${other_cities} - `;
            message += menu.renderPercentage("Другие", other_cities / orderTotalCount);
            message += '\n';
            //По самовывозу
            message += `----------------------\nСтатистика по самовывозу:\n`;
            if (samovivoz > orderTotalCount / 2) {
                message += `\n${samovivoz} - `;
                message += menu.renderPercentage("самовывоз", samovivoz / orderTotalCount);
                message += '\n';
                message += `\n${orderTotalCount - samovivoz} - `;
                message += menu.renderPercentage("курьер", (orderTotalCount - samovivoz) / orderTotalCount);
                message += '\n';
            } else {
                message += `\n${orderTotalCount - samovivoz} - `;
                message += menu.renderPercentage("курьер", (orderTotalCount - samovivoz) / orderTotalCount);
                message += '\n';
                message += `\n${samovivoz} - `;
                message += menu.renderPercentage("самовывоз", samovivoz / orderTotalCount);
                message += '\n';
            }

            if (!ordersCountData.data.length)
                message = `Нет заказов за период с ${fields.from} по ${fields.to}.`;
            return message;
        } catch (e) {
            console.log(`Ошибка в функции renderOrders:${e}`);
            return "";
        }

    }

    async renderCalls(fields) {
        //Фильтр на тип запроса
        let request_type = '';
        if (['days', 'day', 'range'].includes(fields.request_type))
            request_type = fields.request_type;
        else
            request_type = 'days'
        //Начало обработки передаваемых параметра
        if (typeof fields.days == "undefined" || fields.days == null)
            fields.days = 0;
        if (request_type === 'day') {
            fields.to = fields.from;
            request_type = 'days';
        }
        let from = typeof fields.from == "undefined" || fields.from == null ? moment().subtract(fields.days, "days").format("YYYY-MM-DD") : fields.from;
        let to = typeof fields.to == "undefined" || fields.to == null ? moment() : moment(fields.to);
        //т.к. берёт не включительно добавляем +1 день
        to.add(1, "day");
        //Получение данных
        const data = await API.getCalls(fields.days, from, to.format("YYYY-MM-DD"));
        //Возвращаем день назад и преобразуем в строку
        to = to.add(-1, "day").format("YYYY-MM-DD");
        //Начало обработки
        let message = 'Статистика по звонкам: \n---------------------------\n';
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
        statistics['Входящий']['managers'] = [];

        statistics['Исходящий'] = {};
        statistics['Исходящий']['calls_duration'] = 0;
        statistics['Исходящий']['calls_count'] = 0;
        statistics['Исходящий']['time_before_answer'] = 0;
        statistics['Исходящий']['managers'] = [];

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
                    if (call.person !== '' && call.person !== null)
                        menu.searchPushOrdersArrays(call.person, statistics['Входящий']['managers'])
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
                    if (call.person !== '' && call.person !== null)
                        menu.searchPushOrdersArrays(call.person, statistics['Исходящий']['managers'])
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
        menu.sortOrdersArrays(statistics['Входящий'].managers);
        menu.sortOrdersArrays(statistics['Исходящий'].managers);
        //формирование сообщения
        message += request_type === 'range' ?
            `С ${from} по ${to}`
            : fields.days > 0 ? `С ${from} по ${to}` : `На ${from}`;
        message += ` было совершено: ${statistics.calls_count} звонков,
Общей длительностью ${menu.formatSecondsAsHHMMSS(statistics.calls_duration)}, 
Средней продолжительностью: ${menu.formatSecondsAsHHMMSS((statistics.calls_duration / statistics.real_calls_count).toFixed(2))}.
------------------------`;
        //Блок по причинам окончания
        /*
        message+=`Статистика по причинам окончаниям звонка:`;
        for (let reason in statistics.disconnect_reasons.total) {
            message += `\n    ${codes[reason]}: ${statistics.disconnect_reasons.total[reason]},`
        }
        */
        let call_types = ['Входящий', 'Исходящий', 'Недозвон', 'Пропущенный'];
        for (let i in call_types) {
            if (statistics[call_types[i]].calls_count === 0) continue;
            message += `\n${call_types[i]}:\n`;
            message += `\n${statistics[call_types[i]].calls_count} — ${menu.renderPercentage("", statistics[call_types[i]].calls_count / statistics.calls_count)},`;
            message += '\n'
            if (['Входящий', 'Исходящий'].includes(call_types[i])) {
                message += `\n${menu.formatSecondsAsHHMMSS(statistics[call_types[i]].calls_duration)} — Суммарная длительность`;
                message += `\n${menu.formatSecondsAsHHMMSS((statistics[call_types[i]].calls_duration / statistics[call_types[i]].calls_count).toFixed(2))} — Средняя длительность`;
                message += `\n${menu.formatSecondsAsHHMMSS((statistics[call_types[i]].time_before_answer / statistics[call_types[i]].calls_count).toFixed(2))} — Среднее время до ответа`;

                message += '\n';
                for (let j = 0; j < statistics[call_types[i]].managers.length; j++)
                    message += `\n${statistics[call_types[i]].managers[j][1]} — ${menu.renderPercentage(statistics[call_types[i]].managers[j][0], statistics[call_types[i]].managers[j][1] / statistics[call_types[i]].calls_count)}`
            } else
                message += `\n${menu.formatSecondsAsHHMMSS((statistics[call_types[i]].time_before_finish / statistics[call_types[i]].calls_count).toFixed(2))} — Среднее время до сброса звонка`;
            //Блок по причинам окончания звонков
            /*
            message += `\n   По причинам окончания:`;
            for (let reason in statistics.disconnect_reasons[call_types[i]]) {
                message += `\n     ${codes[reason]}: ${statistics.disconnect_reasons[call_types[i]][reason]}`;
            }
             */
            message += '\n---------------------------'
        }
        //managers
        if (!data.data.length)
            message = 'Нет данных по звонкам за период.';
        return message;
    }

    async renderChrono(fields){
        //Фильтр на тип запроса
        let request_type = '';
        if (['days', 'day', 'range'].includes(fields.request_type))
            request_type = fields.request_type;
        else
            request_type = 'days'
        //Начало обработки передаваемых параметра
        if (typeof fields.days == "undefined" || fields.days == null)
            fields.days = 0;
        if (request_type === 'day') {
            fields.to = fields.from;
            request_type = 'days';
        }
        let from = typeof fields.from == "undefined" || fields.from == null ? moment().subtract(fields.days, "days").format("YYYY-MM-DD") : fields.from;
        let to = typeof fields.to == "undefined" || fields.to == null ? moment() : moment(fields.to);
        //т.к. берёт не включительно добавляем +1 день
        to.add(1, "day");
        //Получение данных
        let calls_data=await API.getCalls(fields.days,from,to.format("YYYY-MM-DD"));
        let orders_data=await API.getOrders(fields.days,from,to.format("YYYY-MM-DD"));
        //console.log('calls_data:',calls_data.data);
        //console.log('orders_data:',orders_data.data);
        to=to.add(-1, "day").format("YYYY-MM-DD");
        //Обработка данных
        let statistics={};
        statistics['calls']=[];
        statistics['orders']=[];
        statistics['calls_count']=0;
        statistics['orders_count']=0;
        for(let i=0;i<24;i++)
        {
            let number= i.toString();
            if(i<10)
                number='0'+number;
            statistics['calls'].push([number,0]);
            statistics['orders'].push([number,0]);
        }
        if(calls_data.data!=='')
            calls_data.data.forEach(call=>{
                menu.searchPushOrdersArrays(call.start_time.substr(0,2),statistics['calls']);
                statistics['calls_count']++;
            });
        if(orders_data.data!=='')
            orders_data.data.forEach(order=>{
                menu.searchPushOrdersArrays(moment(order.created_at).format('HH'),statistics['orders']);
                statistics['orders_count']++;
            });
        if(!statistics.calls_count&&!statistics.orders_count)
        {
            if(request_type==='days')
                return `Нет данных за период ${fields.days>0?
                `с ${from} по ${to}`
                :`на ${to}`}`;
            return `Нет данных за период с ${from} по ${to}`;
        }
        let message='Статистика по часам:\n------------------------\n';
        if(request_type==='days')
            message+=fields.days>0?`С ${from} по ${to}`:`На ${from}`;
        else
            message+=`С ${from} по ${to}`;
        message+=' было совершено:\n';
        message+=`${statistics['calls_count']?`${statistics['calls_count']} звонков\n`:''}`;
        message+=`${statistics['orders_count']?`${statistics['orders_count']} заказов\n`:''}`;

        if(statistics['calls_count'])
        {
            message+='------------------------\nЗвонки\n';
            for(let i=0;i<statistics.calls.length;i++)
                message+=`\n${statistics.calls[i][0]} —${menu.renderPercentage('', statistics.calls[i][1] / statistics.calls_count)}`;
        }
        if(statistics['orders_count'])
        {
            message+='------------------------\nЗаказы\n';
            for(let i=0;i<statistics.orders.length;i++)
                message+=`\n${statistics.orders[i][0]} —${menu.renderPercentage('', statistics.orders[i][1] / statistics.orders_count)}`;
        }
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
    order: menu.renderOrderByNumber,
    orders: menu.renderOrders,
    missed: menu.renderMissedCalls,
    calls: menu.renderCalls,
    expenses: menu.renderExpenses,
    managers: menu.renderManagers,
    chrono: menu.renderChrono
};


module.exports = messages;
