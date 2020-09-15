const axios = require('axios');
const UrlBuilder = require('./url-builder.js');
const moment = require('moment');

class DataManager {
    constructor() {

    }


    calcOrdersData(data, shopTitle = 'Вкостюме.ру'){
        return data.reduce(
            (acum, item) => {
                if (item.otkaz_cause_id !== 8 && item.otkaz_cause_id !== 3 && item.shop_title === shopTitle) {
                    if (!acum[item.created_day]) {
                        // eslint-disable-next-line no-param-reassign
                        acum[item.created_day] = {
                            day: moment(item.created_at).toDate(),
                            count: 0,
                            sum: 0,
                            avg: 0,
                        };
                    }
                    if (!acum[item.created_day][item.order_status_title]) {
                        // eslint-disable-next-line no-param-reassign
                        acum[item.created_day][item.order_status_title] = 0;
                    }
                    // eslint-disable-next-line no-param-reassign,no-plusplus
                    acum[item.created_day][item.order_status_title]++;
                    // eslint-disable-next-line no-param-reassign
                    acum[item.created_day].count += 1;
                    // eslint-disable-next-line no-param-reassign
                    acum[item.created_day].sum += item.order_sum;
                    // eslint-disable-next-line no-param-reassign,max-len
                    acum[item.created_day].avg = Math.round(acum[item.created_day].sum / acum[item.created_day].count);
                }
                return acum;
            }, {},
        );
    }

    async getOrdersData(from, to){
        const url = UrlBuilder.renderUrl(from, to);
        const rawOrdersData = await axios.get(url);
        this.ordersData = this.calcOrdersData(rawOrdersData.data);
        return this.ordersData;
    }

    async getOrdersDataByDay(from = moment().startOf('month').format('DD.MM.YYYY'), to = moment().endOf('month').format('DD.MM.YYYY'), valType = 'count'){
        const data = this.ordersData || await this.getOrdersData(from, to);
        const orders = [];
        // console.log(data);
        Object.keys(data).map((key, index)=>{
            orders.push({
                arg: moment(data[key].day).format('DD'),
                val: data[key][valType],
            })
        });
        return orders.reverse();
    }
    async getMissedCalls(from = moment().subtract(1, 'day').startOf('day').format('YYYY-MM-DD'), to = moment().endOf('day').format('YYYY-MM-DD')){
        return await axios.get(`185.176.25.157:3000/missed/missed?date_from=${from}&date_to=${to}`);
    }
}

// (
//     async ()=>{
//         const tgBotDataManager = new DataManager();
//         // const ordersData = await tgBotDataManager.getOrdersData('01.08.2020','31.08.2020');
//         const leadsCount = await tgBotDataManager.getOrdersDataByDay('01.07.2020','31.07.2020');
//         // console.log(ordersData);
//         console.log(leadsCount);
//     }
// )();

module.exports = new DataManager();
