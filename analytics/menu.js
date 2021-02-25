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
            let counter=1;
            while(value>0.05)
            {
                msg+='🟩';
                counter++;
                value-=0.05;
            }
            if(value.toFixed(4)!=0)
                msg+=value>=0.025?'🟢':'⚪️';
            else
                msg+='⬜️';
            for(counter;counter<20;counter++)
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
    ///для сортировки массивов в renderOrders формата arr=[[elem1,count],[elem2,count]]
    sortOrdersArrays(arr) {
        for(let i=0;i<arr.length;i++)
        {
            for(let j=i+1;j<arr.length;j++)
            {
                if(arr[i][1]<arr[j][1])
                {
                    let a=arr[i];
                    arr[i]=arr[j];
                    arr[j]=a;
                }
            }
        }
    }
    ///для отформатированных массивов в renderOrders формата arr=[[elem1,count],[elem2,count]]
    searchPushOrdersArrays(elem,arr)
    {
        let found=false;
        for (let i=0;i<arr.length;i++)
        {
            if(arr[i][0]===elem)
            {
                found=true;
                arr[i][1]++;
                break;
            }
        }
        if(!found)arr.push([elem,1]);
    }
    formatSecondsAsHHMMSS (number,text){
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
    async renderOrders(days) {
        try{
            let from = moment().subtract(days, "days").format("YYYY-MM-DD");
            let to = moment().add(1,"days").format("YYYY-MM-DD");
            //По типам заказов
            const ordersCountData = await API.getOrdersCount(days);
            let orderTotalSum=0;
            let orderTotalCount=0;
            let ordersTypesCount=[];
            ordersCountData.data.forEach((item)=>{
                orderTotalCount+=item.order_count;
                orderTotalSum+=item.order_sum;
                ordersTypesCount.push([item.order_status,item.order_count]);
            });
            //По конкретным заказам
            const ordersData=await API.getOrders(days);
            let otkaz_reasons=[];
            let otkaz_count=0;
            let samovivoz=0;
            let proceed_time=0;
            let proceed_count=0;
            let managers=[];
            let couriers=[];
            let cities=[];
            ordersData.data.forEach((item)=>{
                //Преобразование затраченного времени
                if(item.proceed_time!=null&&item.proceed_time>0)
                {
                    //let created_at=moment(item.created_at.substr(0,19).replace('T',' ')).format('YYYY-MM-DD HH:mm:ss');
                    if(moment(item.created_at).format('HH') > 9 && moment(item.created_at).format('HH') <20)
                    {
                        proceed_time+=parseInt(item.proceed_time);
                        proceed_count++;
                    }
                }
                //Счёт по типам
                if(item.order_status_title==="Отказ")
                {
                    otkaz_count++;
                    menu.searchPushOrdersArrays(item.otkaz_title,otkaz_reasons);
                }
                samovivoz+=item.samovivoz=="нет"?0:1;
                if(item.name!=null)
                    menu.searchPushOrdersArrays(item.name,managers);
                if(item.courier!==null)
                    menu.searchPushOrdersArrays(item.courier,couriers);
                if(item.city!==null)
                    menu.searchPushOrdersArrays(item.city,cities);
            });
            //Сортировка
            menu.sortOrdersArrays(managers);
            menu.sortOrdersArrays(couriers);
            menu.sortOrdersArrays(cities);
            menu.sortOrdersArrays(otkaz_reasons);
            menu.sortOrdersArrays(ordersTypesCount);
            //rework cities
            let other_cities=0;
            for(let i=5;i<cities.length;i++)
                other_cities+=cities[i][1];
            //Начало составления сообщения
            let message = `Счётчик по заказам с ${from} по ${to}: \n ---------------------------\n`;

            message+=`Всего заказов поступило ${orderTotalCount} на сумму ${orderTotalSum}.${proceed_time>0? ` Среднее время обработки заказов - ${menu.formatSecondsAsHHMMSS((proceed_time/proceed_count).toFixed())}`:''}, из них:\n`
            for(let i=0;i<ordersTypesCount.length;i++){
                message+=`\n${ordersTypesCount[i][1]} - `;
                message+=menu.renderPercentage(ordersTypesCount[i][0],ordersTypesCount[i][1]/orderTotalCount);
                message+='\n';
            }
            message+=`----------------------\nСтатистика по причинам отказов\nВсего отказов ${otkaz_count}, из них:\n`;
            for(let i=0;i<otkaz_reasons.length;i++)
            {
                message+=`\n${otkaz_reasons[i][1]} - `;
                message+=menu.renderPercentage(otkaz_reasons[i][0],otkaz_reasons[i][1]/otkaz_count);
                message+='\n';
            }
            message+=`----------------------\nСтатистика по менджерам:\n`;
            for(let i=0;i<managers.length;i++)
            {
                message+=`\n${managers[i][1]} - `;
                message+=menu.renderPercentage(managers[i][0],managers[i][1]/orderTotalCount);
                message+='\n';
            }
            message+=`----------------------\nСтатистика по курьерам:\n`;
            for(let i=0;i<couriers.length;i++)
            {
                message+=`\n${couriers[i][1]} - `;
                message+=menu.renderPercentage(couriers[i][0],couriers[i][1]/orderTotalCount);
                message+='\n';
            }
            message+=`----------------------\nСтатистика по городам:\n`;
            for(let i=0;i<5;i++)
            {
                message+=`\n${cities[i][1]} - `;
                message+=menu.renderPercentage(cities[i][0],cities[i][1]/orderTotalCount);
                message+='\n';
            }
            message+=`\n${other_cities} - `;
            message+=menu.renderPercentage("Другие",other_cities/orderTotalCount);
            message+='\n';
            //По самовывозу
            message+=`----------------------\nСтатистика по самовывозу:\n`;
            if(samovivoz>orderTotalCount/2)
            {
                message+=`\n${samovivoz} - `;
                message+=menu.renderPercentage("самовывоз",samovivoz/orderTotalCount);
                message+='\n';
                message+=`\n${orderTotalCount-samovivoz} - `;
                message+=menu.renderPercentage("курьер",(orderTotalCount-samovivoz)/orderTotalCount);
                message+='\n';
            }
            else
            {
                message+=`\n${orderTotalCount-samovivoz} - `;
                message+=menu.renderPercentage("курьер",(orderTotalCount-samovivoz)/orderTotalCount);
                message+='\n';
                message+=`\n${samovivoz} - `;
                message+=menu.renderPercentage("самовывоз",samovivoz/orderTotalCount);
                message+='\n';
            }

            if (!ordersCountData.data.length)
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
