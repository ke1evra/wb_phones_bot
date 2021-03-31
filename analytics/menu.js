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
        let request_type;
        let from;
        let to;
        switch (fields.request_type) {
            case "range":
                request_type = 'range';
                break;
            case "day":
                request_type = 'days';
                fields.to = fields.from;
                fields.days = 0;
                break;
            case "hours":
                request_type = 'hours';
                fields.hours = typeof fields.hours == 'undefined' || fields.hours == null ? 0 : fields.hours;
                fields.from = moment().subtract(fields.hours, 'hours').format('YYYY-MM-DD');
                fields.time_from = moment().subtract(fields.hours, 'hours').format('HH:mm');
                fields.time_from_unix = moment().subtract(fields.hours, 'hours').unix();
                fields.to = moment().format('YYYY-MM-DD');
                fields.time_to = moment().format('HH:mm');
                fields.time_to_unix = moment().unix();
                break;
            default:
                request_type = 'days';
                if (typeof fields.days == "undefined" || fields.days == null) fields.days = 0;
                fields.from = moment().subtract(fields.days, 'days').format('YYYY-MM-DD');
                fields.to = moment().format('YYYY-MM-DD');
                break;
        }
        from = fields.from;
        to = moment(fields.to);
        //т.к. берёт не включительно добавляем +1 день
        to.add(1, "day");
        //Получение данных
        const data = await API.getMissedCalls(fields.days, from, to.format("YYYY-MM-DD"));
        //Возвращаем день назад и преобразуем в строку
        to = to.add(-1, "day").format("YYYY-MM-DD");

        let message = 'Список пропущенных вызовов ';
        switch (request_type) {
            case 'days':
                message += fields.days > 0 ? `с ${from} по ${to}` : `на ${from}`;
                break;
            case 'range':
                message += from === to ? `с ${from} по ${to}` : `на ${from}`;
                break;
            case 'hours':
                message += from === to ? `на ${from} с ${fields.time_from} по ${fields.time_to}` :
                    `c ${from} ${fields.time_from} по ${to} ${fields.time_to}`;
                break;
        }
        message += ':\n---------------------------\n';
        const menu = [];
        //Только пропущенные
        if (!data.data.length)
            message = 'Нет пропущенных вызовов';
        data.data.map((item, index) => {
            const orderNum = `${item.order_number ? '\nНомер заказа: ' + item.order_number : ''}`;
            const clientName = `${item.client_name ? ' | ' + item.client_name : ''}`;
            const missedAt = moment(item.missed_at).format('DD.MM HH:mm');
            message += `${index + 1}. ${item.client} ( ${missedAt} )\nПопыток дозвона: ${item.nedozvon_cnt}\nЛиния: ${item.line_number}${orderNum}${clientName} \n---------------------------\n`;
            menu.push(new Button(item.client_name, 'some cb'))
        });
        if (request_type === 'hours') {
            //Более долгий, но точный запрос для подсчёта статистики вручную
            to = moment(to).add(1, 'day');
            const calls = await API.getCalls(fields.days, from, to.format("YYYY-MM-DD"));
            to = to.add(-1, 'day').format("YYYY-MM-DD");
            if (calls.data.length) {
                let missed_calls = {};
                let proceeded_clients = {};
                let proceeded_count = 0;
                //Обработка звонков
                calls.data.forEach(call => {
                    switch (call.call_type) {
                        case 'Пропущенный':
                            if (!missed_calls.hasOwnProperty(call.client))
                                missed_calls[call.client] = {
                                    missed_cnt: 1,
                                    nedozvon_cnt: 0,
                                    last_manager_call: null,
                                    last_manager_call_time: null,
                                    last_missed_call: call,
                                    last_missed_call_time: moment.unix(call.start).format('DD.MM HH:mm')
                                };
                            else {
                                missed_calls[call.client].last_missed_call = call;
                                missed_calls[call.client].missed_cnt++;
                            }
                            break;
                        case 'Недозвон':
                            if (missed_calls.hasOwnProperty(call.client)) {
                                missed_calls[call.client].nedozvon_cnt++;
                                missed_calls[call.client].last_manager_call = call;
                            }
                            break;
                        default:
                            if (missed_calls.hasOwnProperty(call.client)) {
                                missed_calls[call.client].last_manager_call = call;
                                missed_calls[call.client].last_manager_call_time = moment.unix(call.start).format('DD.MM HH:mm');
                                if (call.call_type === 'Исходящий')
                                    missed_calls[call.client].nedozvon_cnt++;
                                //Перенос по значению
                                proceeded_clients[call.client] = JSON.parse(JSON.stringify(missed_calls[call.client]));
                                proceeded_count++;
                                delete missed_calls[call.client];
                            }
                            break;
                    }
                });
                //Вывод обработанных
                if (proceeded_count) {
                    let i = 1;
                    for (let client in proceeded_clients) {
                        console.log(`Время:${proceeded_clients[client].last_manager_call.start}\nДо:${fields.time_from_unix}\nПосле:${fields.time_to_unix}`);
                        if (proceeded_clients[client].last_manager_call.start < fields.time_from_unix || proceeded_clients[client].last_manager_call.start > fields.time_to_unix)
                            continue
                        if (i === 1) message += '\nУдалось дозвониться:\n'
                        let manager = proceeded_clients[client].last_manager_call.person !== null ? `\nМенеджер: ${proceeded_clients[client].last_manager_call.person}` : '';
                        let nedozvon_cnt = proceeded_clients[client].nedozvon_cnt ? `\nПопыток дозвона: ${proceeded_clients[client].nedozvon_cnt}` : '';
                        let line_number = proceeded_clients[client].last_manager_call.line_number !== '' && proceeded_clients[client].last_manager_call.line_number != null ? `\nЛиния: ${proceeded_clients[client].last_manager_call.line_number}` : '';
                        message += `${i++}. ${client} ( ${proceeded_clients[client].last_manager_call_time} )${nedozvon_cnt}${line_number}${manager}\n---------------------------\n`;
                    }
                }
                return message;
            }
        }
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
        const numberToManager = require('../constants/vks_numbers')
        if (typeof fields.days == "undefined" || fields.days == null)
            fields.days = 1;
        if (!fields.days) fields.days++
        const data = await API.getManagersCalls(fields.days);
        //console.log(data.data.data1);
        //console.log(data.data.incomingByNumber);
        let message = '\`\`\`— Отчет по менеджерам —————————\n\n';
        const menu = [];
        //console.log(data.data["data1"]);

        let messageData = {}

        messageData['all_managers'] = {}
        messageData['all_managers']['calls'] = {}
        messageData['all_managers']['calls']['basic_info'] = {}
        messageData['all_managers']['calls']['basic_info']['total_calls_count'] = 0
        messageData['all_managers']['calls']['basic_info']['in_calls_time'] = 0
        messageData['all_managers']['calls']['basic_info']['in_waiting_time'] = 0

        messageData['all_managers']['calls']['incoming_calls_info'] = {}
        messageData['all_managers']['calls']['incoming_calls_info']['calls_count'] = 0
        messageData['all_managers']['calls']['incoming_calls_info']['in_calls_time'] = 0
        messageData['all_managers']['calls']['incoming_calls_info']['time_to_answer'] = 0

        messageData['all_managers']['calls']['failed_incoming_calls_info'] = {}
        messageData['all_managers']['calls']['failed_incoming_calls_info']['calls_count'] = 0

        messageData['all_managers']['calls']['outcoming_calls_info'] = {}
        messageData['all_managers']['calls']['outcoming_calls_info']['calls_count'] = 0
        messageData['all_managers']['calls']['outcoming_calls_info']['in_calls_time'] = 0
        messageData['all_managers']['calls']['outcoming_calls_info']['in_waiting_time'] = 0

        messageData['all_managers']['calls']['failed_outcoming_calls_info'] = {}
        messageData['all_managers']['calls']['failed_outcoming_calls_info']['calls_count'] = 0
        messageData['all_managers']['calls']['failed_outcoming_calls_info']['in_waiting_time'] = 0


        data.data["data1"].map((item, index) => {
            if (!messageData[numberToManager[item.person]]) {
                messageData[numberToManager[item.person]] = {}
                messageData[numberToManager[item.person]]['calls'] = {}

                messageData[numberToManager[item.person]]['calls']['basic_info'] = {}
                messageData[numberToManager[item.person]]['calls']['basic_info']['total_calls_count'] = 0
                messageData[numberToManager[item.person]]['calls']['basic_info']['in_calls_time'] = 0
                messageData[numberToManager[item.person]]['calls']['basic_info']['in_waiting_time'] = 0

                messageData[numberToManager[item.person]]['calls']['incoming_calls_info'] = {}
                messageData[numberToManager[item.person]]['calls']['incoming_calls_info']['calls_count'] = 0
                messageData[numberToManager[item.person]]['calls']['incoming_calls_info']['in_calls_time'] = 0
                messageData[numberToManager[item.person]]['calls']['incoming_calls_info']['time_to_answer'] = 0

                messageData[numberToManager[item.person]]['calls']['failed_incoming_calls_info'] = {}
                messageData[numberToManager[item.person]]['calls']['failed_incoming_calls_info']['calls_count'] = 0

                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info'] = {}
                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info']['calls_count'] = 0
                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info']['in_calls_time'] = 0
                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info']['in_waiting_time'] = 0

                messageData[numberToManager[item.person]]['calls']['failed_outcoming_calls_info'] = {}
                messageData[numberToManager[item.person]]['calls']['failed_outcoming_calls_info']['calls_count'] = 0
                messageData[numberToManager[item.person]]['calls']['failed_outcoming_calls_info']['in_waiting_time'] = 0

            }
            messageData[numberToManager[item.person]]['calls']['basic_info']['total_calls_count']++
            messageData['all_managers']['calls']['basic_info']['total_calls_count']++
            if (item.call_type === 'inComing') {
                const callTime = moment(item.end, "HH:mm:ss").diff(moment(moment(item.answer, "HH:mm:ss")), "seconds")
                const answerTime = moment(item.answer, "HH:mm:ss").diff(moment(moment(item.start, "HH:mm:ss")), "seconds")

                messageData[numberToManager[item.person]]['calls']['incoming_calls_info']['calls_count']++
                messageData[numberToManager[item.person]]['calls']['incoming_calls_info']['in_calls_time'] += callTime
                messageData[numberToManager[item.person]]['calls']['incoming_calls_info']['time_to_answer'] += answerTime

                messageData[numberToManager[item.person]]['calls']['basic_info']['in_calls_time'] += callTime

                messageData['all_managers']['calls']['incoming_calls_info']['calls_count']++
                messageData['all_managers']['calls']['incoming_calls_info']['in_calls_time'] += callTime
                messageData['all_managers']['calls']['incoming_calls_info']['time_to_answer'] += answerTime

                messageData['all_managers']['calls']['basic_info']['in_calls_time'] += callTime
            } else if (item.call_type === 'outComing') {
                const callTime = moment(item.end, "HH:mm:ss").diff(moment(moment(item.answer, "HH:mm:ss")), "seconds")
                const waitingTime = moment(item.answer, "HH:mm:ss").diff(moment(moment(item.start, "HH:mm:ss")), "seconds")

                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info']['calls_count']++
                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info']['in_calls_time'] += callTime
                messageData[numberToManager[item.person]]['calls']['outcoming_calls_info']['in_waiting_time'] += waitingTime

                messageData[numberToManager[item.person]]['calls']['basic_info']['in_calls_time'] += callTime
                messageData[numberToManager[item.person]]['calls']['basic_info']['in_waiting_time'] += waitingTime

                messageData['all_managers']['calls']['outcoming_calls_info']['calls_count']++
                messageData['all_managers']['calls']['outcoming_calls_info']['in_calls_time'] += callTime
                messageData['all_managers']['calls']['outcoming_calls_info']['in_waiting_time'] += waitingTime

                messageData['all_managers']['calls']['basic_info']['in_calls_time'] += callTime
                messageData['all_managers']['calls']['basic_info']['in_waiting_time'] += waitingTime
            } else if (item.call_type === 'inComingFail') {
                messageData[numberToManager[item.person]]['calls']['failed_incoming_calls_info']['calls_count']++

                messageData['all_managers']['calls']['failed_incoming_calls_info']['calls_count']++
            } else if (item.call_type === 'outComingFail') {
                const waitingTime = moment(item.end, "HH:mm:ss").diff(moment(moment(item.start, "HH:mm:ss")), "seconds")

                messageData[numberToManager[item.person]]['calls']['failed_outcoming_calls_info']['calls_count']++
                messageData[numberToManager[item.person]]['calls']['failed_outcoming_calls_info']['in_waiting_time'] += waitingTime

                messageData['all_managers']['calls']['failed_outcoming_calls_info']['calls_count']++
                messageData['all_managers']['calls']['failed_outcoming_calls_info']['in_waiting_time'] += waitingTime
                messageData['all_managers']['calls']['basic_info']['in_waiting_time'] += waitingTime
            }

            menu.push(new Button(item.client_name, 'some cb'))
        });

        messageData['all_managers']['calls']['basic_info']['avg_call_duration'] = (messageData['all_managers']['calls']['basic_info']['in_calls_time'] / messageData['all_managers']['calls']['basic_info']['total_calls_count']).toFixed(2)
        messageData['all_managers']['calls']['incoming_calls_info']['avg_time_to_answer'] = (messageData['all_managers']['calls']['incoming_calls_info']['time_to_answer'] / messageData['all_managers']['calls']['incoming_calls_info']['calls_count']).toFixed(2)
        messageData['all_managers']['calls']['failed_incoming_calls_info']['calls_count_percentage'] = (messageData['all_managers']['calls']['failed_incoming_calls_info']['calls_count'] * 100 / messageData['all_managers']['calls']['basic_info']['total_calls_count']).toFixed(2)
        messageData['all_managers']['calls']['failed_outcoming_calls_info']['avg_waiting_time'] = (messageData['all_managers']['calls']['failed_outcoming_calls_info']['in_waiting_time'] / messageData['all_managers']['calls']['failed_outcoming_calls_info']['calls_count']).toFixed(2)


        for (let manager in messageData) {
            if (manager !== "all_managers") {
                messageData[manager]['calls']['basic_info']['calls_count_percentage'] = (messageData[manager]['calls']['basic_info']['total_calls_count'] * 100 / messageData['all_managers']['calls']['basic_info']['total_calls_count']).toFixed(2)
                messageData[manager]['calls']['basic_info']['in_calls_time_percentage'] = (messageData[manager]['calls']['basic_info']['in_calls_time'] * 100 / messageData['all_managers']['calls']['basic_info']['in_calls_time']).toFixed(2)
                messageData[manager]['calls']['basic_info']['business'] = (messageData[manager]['calls']['basic_info']['in_calls_time'] * 100 / (7.5 * fields.days * 60 * 60)).toFixed(2)

                if (messageData[manager]['calls']['incoming_calls_info']['calls_count']) {
                    messageData[manager]['calls']['incoming_calls_info']['avg_time_to_answer'] = (messageData[manager]['calls']['incoming_calls_info']['time_to_answer'] / messageData[manager]['calls']['incoming_calls_info']['calls_count']).toFixed(2)
                }

                messageData[manager]['calls']['failed_incoming_calls_info']['calls_count_percentage'] = (messageData[manager]['calls']['failed_incoming_calls_info']['calls_count'] * 100 / messageData[manager]['calls']['basic_info']['total_calls_count']).toFixed(2)

                if (messageData[manager]['calls']['failed_outcoming_calls_info']['calls_count']) {
                    messageData[manager]['calls']['failed_outcoming_calls_info']['avg_waiting_time'] = (messageData[manager]['calls']['failed_outcoming_calls_info']['in_waiting_time'] / messageData[manager]['calls']['failed_outcoming_calls_info']['calls_count']).toFixed(2)
                }
            }
        }
        console.log(messageData)
        message += `Звонков совершено: ${messageData.all_managers.calls.basic_info.total_calls_count}\n` +
            `Средняя продолжительность звонка: ${messageData.all_managers.calls.basic_info.avg_call_duration}\n` +
            `Среднее время ответа: ${messageData.all_managers.calls.incoming_calls_info.avg_time_to_answer}\n` +
            `Процент пропущенных вызовов: ${messageData.all_managers.calls.failed_incoming_calls_info.calls_count_percentage}%\n` +
            `Среднее время ожидания до сброса при исходящем вызове: ${messageData.all_managers.calls.failed_outcoming_calls_info.avg_waiting_time}`

        const managersOrdersData = await API.getManagersOrders();

        for (let order of managersOrdersData['data']) {
            if (!messageData[order['name']]) {
                messageData[order['name']] = {}
            }
            messageData[order['name']]['orders'] = {}
            if (!messageData[order['name']]['orders'][order['action_title']]) {
                messageData[order['name']]['orders'][order['action_title']] = {}
                messageData[order['name']]['orders'][order['action_title']]['count'] = 0
                messageData[order['name']]['orders'][order['action_title']]['sum'] = 0
            }
            messageData[order['name']]['orders'][order['action_title']]['count']++
            messageData[order['name']]['orders'][order['action_title']]['sum'] += order['order_sum']
        }

        for (let manager in messageData) {
            if (manager !== "all_managers") {
                message += `—— ${manager} ` + '—'.repeat(27-manager.length) + "\n"
                if (messageData[manager]['calls']) {
                        message+=`Всего ${messageData[manager]['calls']['basic_info']['total_calls_count']} (${messageData[manager]['calls']['basic_info']['calls_count_percentage']}%) звонков, из них:`
                    if (messageData[manager]['calls']['incoming_calls_info']['calls_count']) {
                        message += `\nВходящих: ${messageData[manager]['calls']['incoming_calls_info']['calls_count']}, среднее время ответа — ${messageData[manager]['calls']['incoming_calls_info']['avg_time_to_answer']}`
                    }
                    if (messageData[manager]['calls']['outcoming_calls_info']['calls_count']) {
                        message += `\nИсходящих: ${messageData[manager]['calls']['outcoming_calls_info']['calls_count']}`
                    }
                    if (messageData[manager]['calls']['failed_incoming_calls_info']['calls_count']) {
                        message += `\nПропущенных: ${messageData[manager]['calls']['failed_incoming_calls_info']['calls_count']} (${messageData[manager]['calls']['failed_incoming_calls_info']['calls_count_percentage']}%)`
                    }
                    if (messageData[manager]['calls']['failed_outcoming_calls_info']['calls_count']) {
                        message += `\nНедозвонов: ${messageData[manager]['calls']['failed_outcoming_calls_info']['calls_count']}, среднее время ожидания — ${messageData[manager]['calls']['failed_outcoming_calls_info']['avg_waiting_time']}`
                    }

                    message += `\n\nЗанятость: ${messageData[manager]['calls']['basic_info']['business']}%`
                }
                if (messageData[manager]['orders']) {
                    message+="\nзаказы есть\n"
                }
            }
        }
        message += '\n\`\`\`'
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
        let messageData = {}
        messageData.actions = []
        messageData.items = []
        data.data.forEach((item, index) => {
            if (!messageData.actions.includes(item.actions))
                messageData.actions.push(item.actions)
            if (!messageData.items.includes(item.items))
                messageData.items.push(item.items)
            menu.push(new Button(item.client_name, 'some cb'))
        });

        console.log(messageData)

        message =
            `Заказ ${data.data[0].order_number}\n` +
            `-------------------------\n\n` +

            `Cтатус: ${orderStatusIcons[data.data[0].status]} ${data.data[0].status}\n` +
            `Поступил: ${moment(data.data[0].date_of_registration).format("YYYY-MM-DD HH:mm:ss")}, обработан через ${data.data[0].processing_time}\n` +
            `Менеджер: ${data.data[0].manager}\n\n` +

            `-------------------------\n`
        if (data.data[0].client_name || data.data[0].phone_key || data.data[0].email) {
            message += `Клиент:\n\n` +

                `${data.data[0].client_name ? `${data.data[0].client_name}\n` : ''}` +
                `${data.data[0].phone_key ? `${data.data[0].phone_key}${data.data[0].client_dop_phone ? ` (${data.data[0].client_dop_phone})\n` : '\n'}` : ''}` +
                `${data.data[0].email ? `${data.data[0].email}\n` : ''}` +
                `-------------------------\n`
        }


        if (messageData.items.length) {
            message += `Состав:\n\n`
            for (let item of messageData.items) {
                item = item.split('|')
                message += `${parseInt(item[1])} ₽ (${parseInt(item[4])}) — ${item[0]} ${item[3]} (${item[5]}) ${itemStatusIcons[item[2]]} ${item[2]}\n`
            }
            message += `\n`
        }
        if (data.data[0].order_sum || data.data[0].delivery_price || data.data[0].dop_trata) {
            message +=
                `${data.data[0].dop_trata ? `${data.data[0].dop_trata} ₽ — Дополнительная трата\n` : ''}` +
                `${data.data[0].order_sum ? `${data.data[0].order_sum} ₽ — Стоимость заказа\n` : ''}` +
                `${data.data[0].delivery_price ? `${data.data[0].delivery_price} ₽ — Доставка\n` : ''}` +
                `${data.data[0].delivery_price && data.data[0].order_sum ? `${+data.data[0].delivery_price + data.data[0].order_sum} ₽ — Стоимость заказа с доставкой\n` : ''}` +
                `-------------------------\n`
        }

        if (data.data[0].address || data.data[0].courier_del_id || data.data[0].courier || data.data[0].location_name) {
            message += `Доставка:\n\n`
            if (data.data[0].location_name && data.data[0].address) {
                if (data.data[0].address.includes(data.data[0].location_name)) {
                    message += `${data.data[0].address}\n`
                } else {
                    message += `${data.data[0].location_name}, ${data.data[0].address}\n`
                }
            } else {
                message += `${data.data[0].address ? `${data.data[0].address}\n` : ''}`
                message += `${data.data[0].location_name ? `${data.data[0].location_name}\n` : ''}`
            }

            message += `${data.data[0].courier_del_id ? `${data.data[0].courier_del_id}` : ''}${data.data[0].courier && data.data[0].courier_del_id ? ', ' : ''}${data.data[0].courier ? `${data.data[0].courier}` : ''}\n` +
                `-------------------------\n`
        }
        if (messageData.actions.length) {
            message += `Действия:\n`
            for (let action of messageData.actions) {
                action = action.split('|')
                message += `\n${action[1]} — ${action[0] !== "null" ? action[0] : "Система"}\n${action[2]}\n`
            }
            message += `-------------------------\n`
        }

        const getLogs = {}
        getLogs.number = data.data[0].phone_key
        getLogs.from = moment(data.data[0].date_of_registration).subtract(3, "days").unix()
        getLogs.to = moment(data.data[0].date_of_registration).add(3, "days").unix()

        const callsLog = await API.getCallsLogInRangeByPhoneNumber(getLogs.number, getLogs.from, getLogs.to);
        console.log(callsLog)
        if (callsLog.data.length) {
            message += `Звонки:\n`
            callsLog.data.map((item, index) => {
                message += `\n----------\n${index + 1}. ${item.start_day} ${item.start_time} ${callTypeIcons[item.call_type]} ${item.call_type}${(item.call_type === "Входящий") || (item.call_type === "Пропущенный") ? ` (${item.line_number})` : ``}\n\n` +
                    `👤 ${item.person}\n` +
                    (() => {
                        let result
                        if (item.call_type === "Входящий" || item.call_type === "Исходящий") {
                            result = `➡️${item.start_time} — 🕑${new Date(item.answer_time * 1000).toISOString().substr(11, 8)} → 🗣${moment.unix(item.answer).format("HH:mm:ss")} — 🕑${new Date(item.call_duration * 1000).toISOString().substr(11, 8)} → 🏁${moment.unix(item["finish"]).format("HH:mm:ss")}`
                        } else if (item.call_type === "Пропущенный" || item.call_type === "Недозвон") {
                            result = `➡️${moment.unix(item["start"]).format("HH:mm:ss")} — 🕑${new Date(moment.unix(item["finish"]).diff(moment.unix(item["start"]), "seconds") * 1000).toISOString().substr(11, 8)} → 🏁${moment.unix(item["finish"]).format("HH:mm:ss")}`
                        }
                        return result
                    })()//+ ` (${item.disconnect_reason})`
            })
            message += "\n-------------------------"
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
    renderPercentage(title = "", value = 0, colour_id = 0) {
        try {
            if (value > 1 || value < 0) {
                console.log(`Ошибка в функции renderPercentage: Значение "value"=${value} выходит за рамки от 0 до 1!`)
                return "ERROR";
            }
            //Массив цветов белый отсутствует т.к. используется для пустых.
            let colours = [
                ['🟩', '🟢'],//зелёный
                ['🟦', '🔵'],//синий
                ['🟥', '🔴'],//красный
                ['🟧', '🟠'],//оранжевый
                ['🟨', '🟡'],//жёлтый
                ['🟪', '🟣'],//фиолетовый
                ['⬛️', '⚫️'],//чёрный
                ['🟫', '🟤']//коричневый
            ];
            colour_id = colour_id > 7 ? 0 : colour_id;
            let msg = `${title} (${(value * 100).toFixed(2)}%)\n`;
            //Будем вычислять в целых числах
            value = Math.round(value * 1000);
            let counter = 0;
            while (value >= 50) {
                msg += colours[colour_id][0];
                counter++;
                value -= 50;
            }
            if (value) {
                msg += value >= 25 ? colours[colour_id][1] : '⚪️';
                counter++;
            }
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
            if (request_type === 'hours') {
                fields.days = fields.days == null || typeof fields.days == "undefined" ? fields.days = 0 : fields.days;
                fields.hours = fields.hours == null || typeof fields.hours == "undefined" ? fields.hours = 1 : fields.hours;
                fields.from = moment().subtract(fields.hours, 'hours');
                fields.time_from = fields.from.format('HH:mm');
                fields.time_to = moment().format('HH:mm');
                fields.from = fields.from.format("YYYY-MM-DD");
            }
            fields.from = fields.from == null || typeof fields.from == "undefined" ? moment().subtract(fields.days, "days").format("YYYY-MM-DD") : fields.from;
            fields.to = fields.to == null || typeof fields.to == "undefined" ? moment() : moment(fields.to);
            //т.к. берёт не включительно добавляем +1 день
            fields.to.add(1, "day");
            //По типам заказов
            let orderTotalSum = 0;
            let orderTotalCount = 0;
            let ordersTypesCount = [];
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
                if (request_type === 'hours') {
                    if (moment(item.created_at).format('HH:mm') < fields.time_from || moment(item.created_at).format('HH:mm') > fields.time_to)
                        return
                }
                orderTotalCount++;
                orderTotalSum += item.order_sum;
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
                if (item.order_status_title !== null)
                    menu.searchPushOrdersArrays(item.order_status_title, ordersTypesCount);
                if (item.name !== null)
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
            if (cities.length > 5) {
                for (let i = 5; i < cities.length; i++)
                    other_cities += cities[i][1];
            }
            //Начало составления сообщения
            let message = '';
            switch (request_type) {
                case 'days':
                    message += `Статистика по заказам ${fields.days > 0 ? `с ${fields.from}` : `на ${fields.from}`}`
                    break;
                case 'range':
                    if (fields.from !== fields.to)
                        message += `Статистика по заказам на период с ${fields.from} по ${fields.to}`;
                    else
                        message += `Статистика по заказам на период на ${fields.from}`;
                    break;
                case "hours":
                    message += `Статистика по заказам ${fields.from === fields.to ? `на ${fields.from} с ${fields.time_from} по ${fields.time_to}` : `с ${fields.from} ${fields.time_from} по ${fields.to} ${fields.time_to}`}`;
                    break;
                default:
                    message += `Статистика по заказам`;
                    break;
            }
            message += `:\n ---------------------------\n`;
            message += `Всего заказов поступило ${menu.numberWithCommas(orderTotalCount)} на сумму ${menu.numberWithCommas(orderTotalSum)}${proceed_time > 0 ? `. Среднее время обработки заказов - ${menu.formatSecondsAsHHMMSS((proceed_time / proceed_count).toFixed())},` : ','} из них:\n`
            for (let i = 0; i < ordersTypesCount.length; i++) {
                message += `\n${ordersTypesCount[i][1]} - `;
                message += menu.renderPercentage(ordersTypesCount[i][0], ordersTypesCount[i][1] / orderTotalCount);
                message += '\n';
            }
            if (otkaz_reasons.length) {
                message += `----------------------\nСтатистика по причинам отказов\nВсего отказов ${otkaz_count}, из них:\n`;
                for (let i = 0; i < otkaz_reasons.length; i++) {
                    message += `\n${otkaz_reasons[i][1]} - `;
                    message += menu.renderPercentage(otkaz_reasons[i][0], otkaz_reasons[i][1] / otkaz_count);
                    message += '\n';
                }
            }
            if (managers.length) {
                message += `----------------------\nСтатистика по менджерам:\n`;
                for (let i = 0; i < managers.length; i++) {
                    message += `\n${managers[i][1]} - `;
                    message += menu.renderPercentage(managers[i][0], managers[i][1] / orderTotalCount);
                    message += '\n';
                }
            }
            if (couriers.length) {
                message += `----------------------\nСтатистика по курьерам:\n`;
                for (let i = 0; i < couriers.length; i++) {
                    message += `\n${couriers[i][1]} - `;
                    message += menu.renderPercentage(couriers[i][0], couriers[i][1] / orderTotalCount);
                    message += '\n';
                }
            }
            if (cities.length) {
                message += `----------------------\nСтатистика по городам:\n`;
                for (let i = 0; i < Math.min(cities.length, 5); i++) {
                    message += `\n${cities[i][1]} - `;
                    message += menu.renderPercentage(cities[i][0], cities[i][1] / orderTotalCount);
                    message += '\n';
                }
                if (other_cities != null && other_cities > 0) {
                    message += `\n${other_cities} - `;
                    message += menu.renderPercentage("Другие", other_cities / orderTotalCount);
                    message += '\n';
                }
            }
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

            if (!orderTotalCount)
                message = `Нет заказов за период.`;
            return message;
        } catch (e) {
            console.log(`Ошибка в функции renderOrders:${e}`);
            return "";
        }

    }

    async renderCalls(fields) {
        //Фильтр на тип запроса
        let request_type = '';
        if (['days', 'day', 'range', 'hours'].includes(fields.request_type))
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
        if (request_type === 'hours') {
            fields.from = typeof fields.from == "undefined" || fields.from == null ? moment().subtract(fields.hours, "hours").format("YYYY-MM-DD") : fields.from;
            fields.to = typeof fields.to == "undefined" || fields.to == null ? moment() : moment(fields.to);
            fields.time_from = moment().subtract(fields.hours, 'hours').format('HH:mm');
            fields.time_from_unix = moment().subtract(fields.hours, 'hours').unix();
            fields.time_to = moment().format('HH:mm');
            fields.time_to_unix = moment().unix();
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
            if (request_type === 'hours') {
                if (call.start < fields.time_from_unix || call.start > fields.time_to_unix)
                    return
            }
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
        switch (request_type) {
            case 'range':
                message += `С ${from} по ${to}`;
                break;
            case 'days':
                message += fields.days > 0 ? `С ${from} по ${to}` : `На ${from}`;
                break;
            case 'hours':
                if (from === to)
                    message += `На ${from} с ${fields.time_from} по ${fields.time_to}`;
                else
                    message += `С ${from} ${fields.time_from} по ${to} ${fields.time_to}`;
                break;
            default:
                break;
        }
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
        if (statistics.calls_count) {
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
                } else {
                    let time_before_finish = menu.formatSecondsAsHHMMSS((statistics[call_types[i]].time_before_finish / statistics[call_types[i]].calls_count).toFixed(2));
                    if (time_before_finish === '') time_before_finish = '00:00';
                    message += `\n${time_before_finish} — Среднее время до сброса звонка`;

                }
                //Блок по причинам окончания звонков
                /*
                message += `\n   По причинам окончания:`;
                for (let reason in statistics.disconnect_reasons[call_types[i]]) {
                    message += `\n     ${codes[reason]}: ${statistics.disconnect_reasons[call_types[i]][reason]}`;
                }
                 */
                message += '\n---------------------------'
            }
        }

        //managers
        if (!statistics.calls_count)
            message = 'Нет данных по звонкам за период.';
        return message;
    }

    async renderChrono(fields) {
        try {
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
            let calls_data = await API.getCalls(fields.days, from, to.format("YYYY-MM-DD"));
            let orders_data = await API.getOrders(fields.days, from, to.format("YYYY-MM-DD"));
            //console.log('calls_data:',calls_data.data);
            //console.log('orders_data:',orders_data.data);
            to = to.add(-1, "day").format("YYYY-MM-DD");
            //Обработка данных
            let statistics = {};
            statistics['calls'] = [];
            statistics['orders'] = [];
            statistics['calls_count'] = 0;
            statistics['orders_count'] = 0;
            statistics['max_calls_count'] = 0;
            statistics['max_orders_count'] = 0;
            for (let i = 0; i < 24; i++) {
                let number = i.toString();
                if (i < 10)
                    number = '0' + number;
                statistics['calls'].push([number, 0]);
                statistics['orders'].push([number, 0]);
            }
            if (calls_data.data !== '')
                calls_data.data.forEach(call => {
                    menu.searchPushOrdersArrays(call.start_time.substr(0, 2), statistics['calls']);
                    statistics['calls_count']++;
                });
            if (orders_data.data !== '')
                orders_data.data.forEach(order => {
                    menu.searchPushOrdersArrays(moment(order.created_at).format('HH'), statistics['orders']);
                    statistics['orders_count']++;
                });
            statistics['calls'].forEach(item => {
                statistics.max_calls_count = Math.max(item[1], statistics.max_calls_count)
            });
            statistics['orders'].forEach(item => {
                statistics.max_orders_count = Math.max(item[1], statistics.max_orders_count)
            });

            //Функция для отрисовки квадратиков
            function getMultipleSquaresByNumber(title, number = 1, max_number = number ? number : 1, total_number = max_number) {
                let msg = `${title} (${(number / total_number * 100).toFixed(2)}%)\n`;
                if (max_number > 20) {
                    let value = Math.round(number / max_number * 1000);
                    let counter = 0;
                    while (value >= 50) {
                        msg += '🟩';
                        counter++;
                        value -= 50;
                    }
                    if (value) {
                        msg += value >= 25 ? '🟢' : '⚪️';
                        counter++;
                    }
                    for (counter; counter < 20; counter++)
                        msg += '⬜️';
                } else {
                    const multiplier = Math.floor(20 / max_number);
                    for (let i = 0; i < number; i++)
                        for (let j = 0; j < multiplier; j++)
                            msg += '🟩';
                    for (let i = 0; i < 20 - number * multiplier; i++)
                        msg += '⬜️';
                }
                return msg;
            }

            //Формирование сообщения
            if (!statistics.calls_count && !statistics.orders_count) {
                if (request_type === 'days')
                    return `Нет данных за период ${fields.days > 0 ?
                        `с ${from} по ${to}`
                        : `на ${to}`}`;
                return `Нет данных за период с ${from} по ${to}`;
            }
            let message = 'Статистика по часам:\n------------------------\n';
            if (request_type === 'days')
                message += fields.days > 0 ? `С ${from} по ${to}` : `На ${from}`;
            else
                message += `С ${from} по ${to}`;
            message += ' было совершено:\n';
            message += `${statistics['calls_count'] ? `${statistics['calls_count']} звонков\n` : ''}`;
            message += `${statistics['orders_count'] ? `${statistics['orders_count']} заказов\n` : ''}`;
            if (statistics['calls_count']) {
                message += '------------------------\nЗвонки\n';
                for (let i = 0; i < statistics.calls.length; i++)
                    if (statistics.calls[i][1])
                        message += `\n${statistics.calls[i][0]} — ${getMultipleSquaresByNumber(statistics.calls[i][1].toString(), statistics.calls[i][1], statistics.max_calls_count, statistics.calls_count)}`;
            }
            if (statistics['orders_count']) {
                message += '\n------------------------\nЗаказы\n';
                for (let i = 0; i < statistics.orders.length; i++)
                    if (statistics.orders[i][1])
                        message += `\n${statistics.orders[i][0]} — ${getMultipleSquaresByNumber(statistics.orders[i][1].toString(), statistics.orders[i][1], statistics.max_orders_count, statistics.orders_count)}`;
            }
            return message;
        } catch (e) {
            console.log(`Ошибка в функции renderCompare: ${e}`);
            return "Ошибка в выполнении запроса!";
        }
    }

    async renderCompare(fields) {
        //Обработка типов запросов

        let request_type; //По каким промежуткам считается статистика
        let years_number = 0;
        let from;
        let to;
        let data_days = [];
        let data_months = [];
        let data;
        switch (fields.request_type) {
            case "range":
                if (!moment(fields.from).add(24, 'months').isAfter(moment(fields.to))) {
                    request_type = 'years';
                    years_number = -1;//Флаг того, что был дан промежуток
                    from = fields.from;
                    to = fields.to;
                } else if (!moment(fields.from).add(45, 'days').isAfter(moment(fields.to))) {
                    request_type = 'months';
                    from = fields.from;
                    to = fields.to
                } else {
                    request_type = 'days';
                    from = fields.from;
                    to = moment(fields.to).add(1, 'days');
                }
                break;
            //days тоже входит сюда
            default:
                request_type = 'years';
                if (!fields.hasOwnProperty('days') || fields.days == null || fields.days === 0)
                    years_number = 1;
                else
                    years_number = fields.days;
                from = typeof fields.from == 'undefined' || fields.from == null ? moment().subtract(12 * years_number, 'months').format("YYYY-MM-DD") : fields.from;
                to = typeof fields.to == 'undefined' || fields.to == null ? moment().format("YYYY-MM-DD") : fields.to;
                break;
        }
        //Массив цветов белый отсутствует т.к. используется для пустых.
        let colours = [
            ['🟩', '🟢'],//зелёный
            ['🟦', '🔵'],//синий
            ['🟥', '🔴'],//красный
            ['🟧', '🟠'],//оранжевый
            ['🟨', '🟡'],//жёлтый
            ['🟪', '🟣'],//фиолетовый
            ['⬛️', '⚫️'],//чёрный
            ['🟫', '🟤']//коричневый
        ];
        let message = '------------------------\nСравнение\n';
        //console.log(`request_type:${request_type} from:${from} to:${to}`);
        if (request_type === 'years') {
            //получение данных
            //Делим процесс на 2 этапа для скорости 1)по месяцам 2)по дням
            data_days = [];
            data_months = [];
            //c from до конца месяца
            data = await API.getOrdersSumByDay(null, from, moment(from).endOf('month').add(1, 'day').format("YYYY-MM-DD"));
            data_days.push(data.data);
            //с след месяца после from по месяц до to
            data = await API.getOrdersSumByMonth(null, moment(from).add(1, 'month').startOf('month').format("YYYY-MM-DD"), moment(to).startOf('month').format("YYYY-MM-DD"));
            data_months = data.data;
            //последний месяц до to
            data = await API.getOrdersSumByDay(null, moment(to).startOf('month').format("YYYY-MM-DD"), moment(to).add(1, "day").format("YYYY-MM-DD"));
            data_days.push(data.data);
            //Обработка полученных данных
            let statistics = {};
            statistics['years'] = [];
            statistics['year_stat'] = {};
            statistics['total_sum'] = 0;
            statistics['order_count'] = 0;
            //по дням
            data_days[0].forEach(day => {
                let year = moment(day.date).format('YYYY');
                if (!statistics.years.includes(year)) {
                    statistics.years.push(year);
                    statistics.year_stat[year] = {
                        order_sum: 0,
                        order_count: 0
                    }
                }
                statistics.order_count += day["order_count"];
                statistics.year_stat[year].order_count += day["order_count"];
                statistics.total_sum += day["order_sum"];
                statistics.year_stat[year].order_sum += day["order_sum"];
            });
            //по месяцам
            data_months.forEach(month => {
                let year = moment(month.date).format('YYYY');
                if (!statistics.years.includes(year)) {
                    statistics.years.push(year);
                    statistics.year_stat[year] = {
                        order_sum: 0,
                        order_count: 0
                    }
                }
                statistics.order_count += month["order_count"];
                statistics.year_stat[year].order_count += month["order_count"];
                statistics.total_sum += month["order_sum"];
                statistics.year_stat[year].order_sum += month["order_sum"];
            });
            //по дням после
            data_days[1].forEach(day => {
                let year = moment(day.date).format('YYYY');
                if (!statistics.years.includes(year)) {
                    statistics.years.push(year);
                    statistics.year_stat[year] = {
                        order_sum: 0,
                        order_count: 0
                    }
                }
                statistics.order_count += day["order_count"];
                statistics.year_stat[year].order_count += day["order_count"];
                statistics.total_sum += day["order_sum"];
                statistics.year_stat[year].order_sum += day["order_sum"];
            });
            //составление сообщения
            if (years_number === -1)
                message += `В преиод с ${from} по ${to}\n`;
            else
                message += years_number > 0 ? `В преиод с ${from.substr(0, 4)} по ${to.substr(0, 4)}\n` : `На ${from.substr(0, 4)}\n`;

            //Вывод шапки
            let colour = 0;
            if (years_number <= 7) {
                for (let year in statistics.year_stat) {
                    message += `${colours[colour][0]} ${year}    `;
                    colour++;
                }
            }
            colour = 0;
            for (let year in statistics.year_stat) {
                message += `\n${year} — ${menu.numberWithCommas(statistics.year_stat[year].order_count)} заказов на сумму: ${menu.renderPercentage(menu.numberWithCommas(statistics.year_stat[year].order_sum) + ' ₽', statistics.year_stat[year].order_count / statistics.order_count, colour)}`;
                if (years_number <= 7)
                    colour++;
            }
        } else if (request_type === 'months') {
            //Получение данных
            //Делим процесс на 2 этапа для скорости 1)по месяцам 2)по дням
            data_days = [];
            data_months = [];
            //c from до конца месяца
            data = await API.getOrdersSumByDay(null, from, moment(from).endOf('month').add(1, 'day').format("YYYY-MM-DD"));
            data_days.push(data.data);
            //с след месяца после from по месяц до to
            data = await API.getOrdersSumByMonth(null, moment(from).add(1, 'month').startOf('month').format("YYYY-MM-DD"), moment(to).startOf('month').format("YYYY-MM-DD"));
            data_months = data.data;
            //последний месяц до to
            data = await API.getOrdersSumByDay(null, moment(to).startOf('month').format("YYYY-MM-DD"), moment(to).add(1, "day").format("YYYY-MM-DD"));
            data_days.push(data.data);
            //console.log(`data_days:${data_days}`);
            //console.log(`data_month:${data_months}`);
            //Обработка
            let statistics = [];
            statistics['months_count'] = 0;
            statistics['months'] = {};
            statistics['total_sum'] = 0;
            statistics['order_count'] = 0;
            //По дням до периода по месяцам
            data_days[0].forEach(item => {
                let month = moment(item.date).format('MMM YYYY');
                if (!statistics.months.hasOwnProperty(month)) {
                    statistics.months[month] = {
                        order_sum: 0,
                        order_count: 0
                    }
                    statistics.months_count++;
                }
                statistics.order_count += item["order_count"];
                statistics.months[month].order_count += item["order_count"];
                statistics.total_sum += item["order_sum"];
                statistics.months[month].order_sum += item["order_sum"];
            });
            //По месяцам
            data_months.forEach(item => {
                let month = moment(item.date).format('MMM YYYY');
                if (!statistics.months.hasOwnProperty(month)) {
                    statistics.months[month] = {
                        order_sum: 0,
                        order_count: 0
                    }
                    statistics.months_count++;
                }
                statistics.order_count += item["order_count"];
                statistics.months[month].order_count += item["order_count"];
                statistics.total_sum += item["order_sum"];
                statistics.months[month].order_sum += item["order_sum"];
            });
            //По дням
            data_days[1].forEach(item => {
                let month = moment(item.date).format('MMM YYYY');
                if (!statistics.months.hasOwnProperty(month)) {
                    statistics.months[month] = {
                        order_sum: 0,
                        order_count: 0
                    }
                    statistics.months_count++;
                }
                statistics.order_count += item["order_count"];
                statistics.months[month].order_count += item["order_count"];
                statistics.total_sum += item["order_sum"];
                statistics.months[month].order_sum += item["order_sum"];
            });
            //Формирование сообщения
            message += `В преиод с ${from} по ${to}\n`;
            //Вывод шапки
            let colour = 0;
            if (statistics.months_count <= 7) {
                for (let month in statistics.months) {
                    message += `${colours[colour][0]} ${month}    `;
                    colour++;
                }
            }
            colour = 0;
            for (let month in statistics.months) {
                message += `\n${month} — ${menu.numberWithCommas(statistics.months[month].order_count)} заказов на сумму: ${menu.renderPercentage(menu.numberWithCommas(statistics.months[month].order_sum) + ' ₽', statistics.months[month].order_count / statistics.order_count, colour)}`;
                if (statistics.months_count <= 7)
                    colour++;
            }
        } else {
            const data = await API.getOrdersSumByDay(null, from, to.format("YYYY-MM-DD"));
            to = to.add(-1, 'days').format("YYYY-MM-DD");
            //Обработка
            let statistics = [];
            statistics['days_count'] = 0;
            statistics['days'] = {};
            statistics['total_sum'] = 0;
            statistics['order_count'] = 0;
            data.data.forEach(item => {
                let day = moment(item.date).format("MM-DD");
                if (!statistics.days.hasOwnProperty(day)) {
                    statistics.days[day] = {
                        order_sum: 0,
                        order_count: 0
                    }
                    statistics.days_count++;
                }
                statistics.order_count += item["order_count"];
                statistics.days[day].order_count += item["order_count"];
                statistics.total_sum += item["order_sum"];
                statistics.days[day].order_sum += item["order_sum"];
            });
            //Формирование сообщения
            message += `В преиод с ${from} по ${to}\n`;
            //Вывод шапки
            let colour = 0;
            if (statistics.days_count <= 7) {
                for (let day in statistics.days) {
                    message += `${colours[colour][0]} ${day}    `;
                    colour++;
                }
            }
            colour = 0;
            for (let day in statistics.days) {
                message += `\n${day} — ${menu.numberWithCommas(statistics.days[day].order_count)} заказов на сумму: ${menu.renderPercentage(menu.numberWithCommas(statistics.days[day].order_sum) + ' ₽', statistics.days[day].order_count / statistics.order_count, colour)}`;
                if (statistics.days_count <= 7)
                    colour++;
            }
        }
        return message;
    }

    async renderHelp(fields) {
        let message = '';
        switch (fields.request_type) {
            case 'order':
                message = 'Информация по команде /order\n';
                message += 'Команда получает на вход номер заказа, по которому выводится полная информация.\n' +
                    'Например: /order 1138412';
                break;
            case 'orders':
                message += 'Информация по команде /orders\nВ случае ошибок при вводе выводится статистика за текущий день.';
                message += 'Команда поддерживает следующие перегрузки:' +
                    '\n   range:  Получает на вход две даты' +
                    '\n           в формате ГГГГ-ММ-ДД через пробел.' +
                    '\n           Например: /orders range 2020-01-01 2020-02-01' +
                    '\n           Суммирует статистику за период. Даты берутся' +
                    '\n           включительно. При передаче одиннаковых дат выводит' +
                    '\n           статистику за указанный день.' +
                    '\n   day:    Получает на вход одну дату в формате ГГГГ-ММ-ДД.' +
                    '\n           Например: /orders day 2020-01-01' +
                    '\n           Выводит статистику за указанный день.' +
                    '\n   hours:  Получает на вход число часов.' +
                    '\n           Например: /orders hours 5' +
                    '\n           Выводит статистику за последние часы. В случае' +
                    '\n           отсутствия числа выводится статистика за последний час.' +
                    '\n   N:      При получении числа "N", суммируется статистика' +
                    '\n           за последние "N" дней.' +
                    '\n           Например: /orders 5' +
                    '\n           В случае отсутствия числа выводится' +
                    '\n           статистика за текущий день.';
                break;
            case 'expenses':
                message += 'Информация по команде /expenses\nВ случае ошибок при вводе выводится статистика за текущий день.';
                message += 'Команда поддерживает следующие перегрузки:' +
                    '\n   range:  Получает на вход две даты' +
                    '\n           в формате ГГГГ-ММ-ДД через пробел.' +
                    '\n           Например: /expenses range 2020-01-01 2020-02-01' +
                    '\n           Суммирует статистику за период. Даты берутся' +
                    '\n           включительно. При передаче одиннаковых дат выводит' +
                    '\n           статистику за указанный день.' +
                    '\n   day:    Получает на вход одну дату в формате ГГГГ-ММ-ДД.' +
                    '\n           Например: /expenses day 2020-01-01' +
                    '\n           Выводит статистику за указанный день.' +
                    '\n   N:      При получении числа "N", суммируется статистика' +
                    '\n           за последние "N" дней.' +
                    '\n           Например: /expenses 5' +
                    '\n           В случае отсутствия числа выводится' +
                    '\n           статистика за текущий день.';
                break;
            case 'calls':
                message += 'Информация по команде /calls\nВ случае ошибок при вводе выводится статистика за текущий день.';
                message += '\nКоманда поддерживает следующие перегрузки:' +
                    '\n   range:  Получает на вход две даты' +
                    '\n           в формате ГГГГ-ММ-ДД через пробел.' +
                    '\n           Например: /calls range 2020-01-01 2020-02-01' +
                    '\n           Суммирует статистику за период. Даты берутся' +
                    '\n           включительно. При передаче одиннаковых дат выводит' +
                    '\n           статистику за указанный день.' +
                    '\n   day:    Получает на вход одну дату в формате ГГГГ-ММ-ДД.' +
                    '\n           Например: /calls day 2020-01-01' +
                    '\n           Выводит статистику за указанный день.' +
                    '\n   hours:  Получает на вход число часов.' +
                    '\n           Например: /calls hours 5' +
                    '\n           Выводит статистику за последние часы. В случае' +
                    '\n           отсутствия числа выводится статистика за последний час.' +
                    '\n   N:      При получении числа "N", предоставляет статистику' +
                    '\n           за последние "N" дней.' +
                    '\n           Например: /calls 5' +
                    '\n           В случае отсутствия числа выводится статистика за текущий день.';
                break;
            case 'managers':
                message = 'help managers info';
                break;
            case 'missed':
                message += 'Информация по команде /missed\nВ случае ошибок при вводе выводится статистика за текущий день.';
                message += 'Команда поддерживает следующие перегрузки:' +
                    '\n   range:  Получает на вход две даты' +
                    '\n           в формате ГГГГ-ММ-ДД через пробел.' +
                    '\n           Например: /missed range 2020-01-01 2020-02-01' +
                    '\n           Предоставляет список пропущенных за период. Даты' +
                    '\n           берутся включительно. При передаче одиннаковых дат' +
                    '\n           выводит список пропущенных за указанный день.' +
                    '\n   day:    Получает на вход одну дату в формате ГГГГ-ММ-ДД.' +
                    '\n           Например: /missed day 2020-01-01' +
                    '\n           Выводит список пропущенных за указанный день.' +
                    '\n   hours:  Получает на вход число часов.' +
                    '\n           Например: /missed hours 5' +
                    '\n           Выводит статистику за последние часы. В случае' +
                    '\n           отсутствия числа выводится статистика ' +
                    '\n           за последний час.' +
                    '\n   N:      При получении числа "N", предоставляет список' +
                    '\n           пропущенных за последние "N" дней.' +
                    '\n           Например: /missed 5' +
                    '\n           В случае отсутствия числа выводится список' +
                    '\n           пропущенных за текущий день.';
                break;
            case 'chrono':
                message += 'Информация по команде /chrono\n';
                message += 'Команда поддерживает следующие перегрузки:' +
                    '\n   range:  Получает на вход две даты' +
                    '\n           в формате ГГГГ-ММ-ДД через пробел.' +
                    '\n           Например: /chrono range 2020-01-01 2020-02-01' +
                    '\n           Предоставляет статистику за период. Даты берутся' +
                    '\n           включительно. При передаче одиннаковых дат выводит' +
                    '\n           статистику за указанный день.' +
                    '\n   day:    Получает на вход одну дату в формате ГГГГ-ММ-ДД.' +
                    '\n           Например: /chrono day 2020-01-01' +
                    '\n           Выводит статистику за указанный день.' +
                    '\n   N:      При получении числа "N", предоставляет статистику' +
                    '\n           за последние "N" дней.' +
                    '\n           Например: /chrono 5' +
                    '\n           В случае отсутствия числа выводится ' +
                    '\n           статистика за текущий день.';
                break;
            case 'compare':
                message += 'Информация по команде /compare\n';
                message += 'Команда поддерживает следующие перегрузки:' +
                    '\n   range:  Получает на вход две даты' +
                    '\n           в формате ГГГГ-ММ-ДД через пробел.' +
                    '\n           Например: /compare range 2020-01-01 2020-02-01' +
                    '\n           Предоставляет статистику за период. Даты берутся' +
                    '\n           включительно. В случае если между датами меньше 45' +
                    '\n           дней, статистика делится по дням. В случае, если' +
                    '\n           между промежуток между датами больше 2 лет,' +
                    '\n           то статистика делится по годам. Иначе ' +
                    '\n           статистика представляется по месяцам.' +
                    '\n   N:      При получении числа "N", предоставляет статистику' +
                    '\n           за последние "N" лет.' +
                    '\n           Например: /compare 5' +
                    '\n           В случае отсутствия числа выводится статистика' +
                    '\n           за текущий и прошлый год.';
                break;
            default:
                message += 'Команда /help предоставляет информацию по использованию различных команд.\n'
                message += `Наберите /help название_команды для вывода справки по ней.
    Список команд:
        /order
        /orders
        /expenses
        /calls
        /managers
        /missed
        /chrono
        /compare`;
                break;
        }
        return message
    }
}

const menu = new Menu();

const messages = {
    hello:
        `
    Привет 👋, я VI (Сокращенно от Vkostume Informer)
    Я умею показывать статистику:
    /order - по заказу с заданным номером
    /orders - по заказам
    /expenses - расходу
    /calls - по звонкам 
    /managers - по менеджерам
    /missed - по пропущенным звонкам
    /chrono - по заказам и звонкам за час
    /compare - по заказам за промежутки.
    
    /help - помощь по командам
    `,
    order: menu.renderOrderByNumber,
    orders: menu.renderOrders,
    missed: menu.renderMissedCalls,
    calls: menu.renderCalls,
    expenses: menu.renderExpenses,
    managers: menu.renderManagers,
    chrono: menu.renderChrono,
    compare: menu.renderCompare,
    help: menu.renderHelp
};


module.exports = messages;
