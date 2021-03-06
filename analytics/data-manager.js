const axios = require("axios");
const UrlBuilder = require("./url-builder.js");
const moment = require("moment");
const API_IP = require('../constants/API_IP');

class DataManager {
    constructor() {
    }

    calcOrdersData(data, shopTitle = "Вкостюме.ру") {
        return data.reduce((acum, item) => {
            if (
                item.otkaz_cause_id !== 8 &&
                item.otkaz_cause_id !== 3 &&
                item.shop_title === shopTitle
            ) {
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
                acum[item.created_day].avg = Math.round(
                    acum[item.created_day].sum / acum[item.created_day].count
                );
            }
            return acum;
        }, {});
    }

    async getOrdersData(from, to) {
        const url = UrlBuilder.renderUrl(from, to);
        const rawOrdersData = await axios.get(url);
        this.ordersData = this.calcOrdersData(rawOrdersData.data);
        return this.ordersData;
    }

    async getOrdersDataByDay(
        from = moment().startOf("month").format("DD.MM.YYYY"),
        to = moment().endOf("month").format("DD.MM.YYYY"),
        valType = "count"
    ) {
        const data = this.ordersData || (await this.getOrdersData(from, to));
        const orders = [];
        // console.log(data);
        Object.keys(data).map((key, index) => {
            orders.push({
                arg: moment(data[key].day).format("DD"),
                val: data[key][valType],
            });
        });
        return orders.reverse();
    }

    async getMissedCalls(
        days = 1,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().add(1, "day").format("YYYY-MM-DD")
    ) {
        return await axios.get(
            `${API_IP}/calls/missed?date_from=${from}&date_to=${to}`
        );
    }

    async getExpenses(
        days = 1,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().endOf("day").format("YYYY-MM-DD")
    ) {
        return await axios.get(
            `${API_IP}/expenses/cost?date_from=${from}&date_to=${to}&shop=vkostume`
        );
    }

    async getManagersCalls(
        days = 0,
        from = moment().startOf('day').subtract(days, "days").unix(),
        to = moment().startOf('day').add(1, "day").unix()
    ) {
        return await axios.get(
            `${API_IP}/mango/day?date_from=${from}&date_to=${to}`
        );
    }

    async getManagersOrders(
        days = 0,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().add(1, "days").format("YYYY-MM-DD")
    ) {
        return await axios.get(
            `${API_IP}/orders/managers?date_from=${from}&date_to=${to}`
        );
    }

    async getOrdersCount(
        days = 0,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().add(1, "day").format("YYYY-MM-DD")
    ) {
        return await axios.get(
            `${API_IP}/orders/cnt?date_from=${from}&date_to=${to}`
        );
    }

    async getOrdersSumByMonth(
        months = 0,
        from = moment().subtract(months, "months").format("YYYY-MM-DD"),
        to = moment().add(1, "day").format("YYYY-MM-DD"),
        shop_id = 1
    ) {
        return await axios.get(
            `${API_IP}/orders/month/sum?date_from=${from}&date_to=${to}&shop=${shop_id}`
        );
    }

    async getOrdersSumByDay(
        days = 0,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().add(1, "day").format("YYYY-MM-DD"),
        shop_id = 1
    ) {
        return await axios.get(
            `${API_IP}/orders/day/sum?date_from=${from}&date_to=${to}&shop=${shop_id}`
        );
    }

    async getOrders(
        days = 0,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().add(1, "days").format("YYYY-MM-DD")
    ) {
        return await axios.get(
            `${API_IP}/orders/?date_from=${from}&date_to=${to}`
        );
    }

    async getOrderByNumber(
        order_number = 1
    ) {
        return await axios.get(
            `${API_IP}/orders/number?order_number=${order_number}`
        );
    }

    async getCallsLogInRangeByPhoneNumber(
        number = 1, date_from, date_to
    ) {
        return await axios.get(
            `${API_IP}/calls/clientInRange?number=${number}&date_from=${date_from}&date_to=${date_to}`
        );
    }

    async getCalls(
        days = 0,
        from = moment().subtract(days, "days").format("YYYY-MM-DD"),
        to = moment().add(1, "days").format("YYYY-MM-DD")
    ) {
        return await axios.get(
            `${API_IP}/calls/range?date_from=${from}&date_to=${to}`
        );
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
