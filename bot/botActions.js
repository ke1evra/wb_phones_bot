const bot = require("./bot.js");
const chats = require("./chatList.js");
const moment = require("moment");
const htmlToText = require("html-to-text");
const gApi = require("../googleApi/googleApiManager.js");
const menu = require("../analytics/menu.js");
const spamList = require("../constants/SpamList.js")

const shortenMessage = (str, len = 400) => {
    let shortStr = "";
    shortStr = str.split("", len).join("") + "...";
    return shortStr;
};

const methods = {
    sendMessageFromZebra(b) {
        const chat = chats.wb_phones;
        const message = `sms от ${b.src} на ${b.dst} (${moment().format(
            "DD.MM.YYYY HH:mm:ss"
        )})\n---------------------\n${b.body}`;
        let thisIsSpam = false
        spamList.forEach(spam => {
            message.includes(spam) ? thisIsSpam = true : null;
        })
        if (!thisIsSpam) {
            return bot
                .sendMessage(chat, message)
                .then(() => {
                    console.log(`Cообщение\n"${message.slice(0, 80)}"\nуспешно отправлено в чат (${chat})`);
                })
                .catch((e) => {
                    console.log(e);
                });
        } else {
            console.log(`Cообщение\n"${message.slice(0, 80)}"\nбыло расцененно как спам`);
            return Promise.resolve()
        }
    },
    formatEmailMessage(b) {
        let text = htmlToText.fromString(b.html, {
            wordwrap: false,
            ignoreImage: true,
        });
        text = text.replace(/[\r\n]{3,}/g, "\n\n");
        return `${b.from.value[0].name} <${b.from.value[0].address}> (${moment(
            b.date
        ).format("DD.MM.YYYY HH:mm:ss")})\n${
            b.subject
        }\n---------------------\n${text}`;
    },
    sendMessageToManagersFromEmail(b) {
        const chat = chats.manager;
        const message = this.formatEmailMessage(b);
        return bot
            .sendMessage(chat, message)
            .then(() => {
                console.log(`сообщение ${message} успешно отправлено в чат (${chat})`);
            })
            .catch((e) => {
                console.log(e);
            });
    },
    resendEmailToChat(b, chat, message = null, options = {}) {
        if (!message) message = this.formatEmailMessage(b);
        return bot
            .sendMessage(chat, message, options)
            .then((msg) => {
                console.log(
                    `сообщение (id: ${msg.message_id})${message} успешно отправлено в чат (${chat})`
                );
                return msg;
            })
            .catch((e) => {
                console.log(e);
            });
    },
    resendEmailToChatAsHTML(b, chat) {
        const message = this.formatEmailMessage(b);
        const shortMessage = shortenMessage(message);
        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{text: "📤 Показать целиком", callback_data: "open"}],
                ],
            }),
            disable_web_page_preview: true,
        };
        return this.resendEmailToChat(b, chat, shortMessage, options)
            .then((msg) => {
                gApi
                    .addRow(msg.chat.id, msg.message_id, message)
                    .then(() => console.log("сообщение записано в таблицу"));
            })
            .catch((e) => {
                console.log(e);
            });
    },
    async toggleOpenCloseMessage(bot, chat_id, message_id, action_type) {
        const button =
            action_type === "open"
                ? {text: "📥 Скрыть", callback_data: "close"}
                : {text: "📤 Показать целиком", callback_data: "open"};
        const messages = await gApi.getMessages();
        const message =
            action_type === "open"
                ? shortenMessage(messages[chat_id][message_id], 4000)
                : shortenMessage(messages[chat_id][message_id]);
        return bot.editMessageText(message, {
            chat_id,
            message_id,
            reply_markup: JSON.stringify({
                inline_keyboard: [[button]],
            }),
            disable_web_page_preview: true,
        });
    },
    ///Отправляет сообщение:message в чат:chat_id
    async sendMsg(chat_id, message) {
        try {
            return bot
                .sendMessage(chat_id, message, parse_mode="Markdown")
                .then((msg) => {
                    console.log(`сообщение (id: ${msg.message_id})${message.length > 80 ? message.substr(0, 80) + '...' : message} успешно отправлено в чат (${chat_id})`
                    );
                    return msg;
                }).catch((e) => {
                    console.log(e);
                });
        } catch (e) {
            console.log(e);
        }
    },
    ///Данный метод выбирает
    async sendMessageByType(router_type = null, msg = null, fields = {}) {
        if (router_type == null) return;
        try {
            let chat_id = msg ? msg.chat.id : chats.manager;
            if (requests.hasOwnProperty(router_type)) {
                let message = '';
                if (typeof requests[router_type] == 'function')
                    message = await requests[router_type](fields);
                else
                    message = requests[router_type];
                const messageList = message.match(/[\s\S]{1,4000}/g) || [];
                //Отправка сообщений
                for (let message of messageList)
                    await methods.sendMsg(chat_id, message);
            } else {
                let message = "Данный тип запроса отсутствует в списке. Проверьте правильность запроса.";
                await methods.sendMsg(chat_id, message);
            }
        } catch (e) {
            console.log(e);
        }
    },
};
///Выставляет соответствие между типом запроса и функцией рендера сообщения
const requests = {
    'start': menu.hello,
    'missed': menu.missed,
    'managers': menu.managers,
    'expenses': menu.expenses,
    'orders': menu.orders,
    'order': menu.order,
    'calls': menu.calls,
    'chrono':menu.chrono,
    'compare':menu.compare,
    'help':menu.help
};

bot.on("callback_query", function (msg) {
    methods
        .toggleOpenCloseMessage(
            bot,
            msg.message.chat.id,
            msg.message.message_id,
            msg.data
        )
        .then(() => {
            console.log(`Сообщение успешно отредактировано (${msg.data})`);
        })
        .catch((e) => {
            console.log(e);
        });
});
bot.onText(/^\/([a-z]+)\s*.*/, async (msg, match) => {
    try {
        console.log('match=',match);
        let router_type = match[1];
        let fields = {};
        if (router_type === "order") {
            fields["request_type"] = "number";
            fields["order_number"] = match[0].match(/\/order\s*(\d+)?/)[1]
            console.log(fields)
        } else if(router_type==='help'){
            let a=match[0].match(/^\/help\s*(\S*)/);
            fields['request_type']=a[1];
        }
        else {
            //Начинаем проверку на типы запросов
            //Запрос range
            if (/\s*range\s(\d{4}-\d{2}-\d{2})\s*(\d{4}-\d{2}-\d{2})/.test(match[0])) {
                fields["request_type"] = "range";
                let from_to = match[0].match(/\s*range\s(\d{4}-\d{2}-\d{2})\s*(\d{4}-\d{2}-\d{2})/);
                fields["from"] = moment(from_to[1]).format("YYYY-MM-DD");
                fields["to"] = moment(from_to[2]).format("YYYY-MM-DD");
            }
            //Запрос day
            else if (/\s*day\s*(\d{4}-\d{2}-\d{2})/.test(match[0])) {
                fields["request_type"] = "day";
                fields["from"] = match[0].match(/\s*day\s*(\d{4}-\d{2}-\d{2})/);
                fields["from"] = moment(fields["from"][1]).format("YYYY-MM-DD");
                fields["days"] = 0;
            }
            else if(/\s*hours\s*(\d+)?/.test(match[0])){
                fields["request_type"] = "hours";
                let hour = match[0].match(/\s*hours\s*(\d+)?/);
                fields["hours"] = hour[1] ? hour[1] : 1;
            }
            else if (/^\/[a-z]+\s*(\d+)?/.test(match[0])) {
                fields["request_type"] = "days";
                let day = match[0].match(/^\/[a-z]+\s*(\d+)?/);
                fields["days"] = day[1] ? day[1] : 0;
            }
        }

        await methods.sendMessageByType(router_type, msg, fields);
    } catch (e) {
        console.log(e);
    }
});
// methods.checkMissedCalls().catch(e => console.log(e));
setInterval(async () => {
    if (moment().format("HH") > 9 && moment().format("HH") < 20) {
        await methods.sendMessageByType('missed');
    }
}, 60 * 60 * 1000);
//вывод статистики по Понедельникам
setInterval(async () => {
    //По месяцам
    if(moment().format('DD HH-mm-ss')==='01 00-00-01'){
        await methods.sendMsg(chats.reports_month,`Отчёт за ${moment().subtract(1,'month').format('MMMM YYYY')}`);
        let fields= {
            request_type:'range',
            from: moment().subtract(1, 'month').startOf('day').format('YYYY-MM-DD'),
            to: moment().subtract(1, 'day').endOf('day').format('YYYY-MM-DD'),
        };
        await methods.sendMessageByType('missed',{chat:{id:chats.reports_month}},fields);
        await methods.sendMessageByType('orders',{chat:{id:chats.reports_month}},fields);
        await methods.sendMessageByType('calls',{chat:{id:chats.reports_month}},fields);
        //await methods.sendMessageByType('managers',{chat:{id:chats.reports_month}},fields);
        await methods.sendMessageByType('chrono',{chat:{id:chats.reports_month}},fields);
        await methods.sendMessageByType('compare',{chat:{id:chats.reports_month}},fields);
    }
    //По неделям
    if(moment().format('dddd')==='понедельник'&&moment().format('HH-mm-ss')==='00-00-01')
    {
        await methods.sendMsg(chats.reports_week,`Отчёт с ${moment().subtract(1,'week').format('YYYY-MM-DD')} по ${moment().subtract(1,'day').format('YYYY-MM-DD')}`);
        let fields= {
            request_type:'range',
            from: moment().subtract(1, 'week').startOf('day').format('YYYY-MM-DD'),
            to: moment().subtract(1, 'day').endOf('day').format('YYYY-MM-DD'),
        };
        await methods.sendMessageByType('missed',{chat:{id:chats.reports_week}},fields);
        await methods.sendMessageByType('orders',{chat:{id:chats.reports_week}},fields);
        await methods.sendMessageByType('calls',{chat:{id:chats.reports_week}},fields);
        //await methods.sendMessageByType('managers',{chat:{id:chats.reports_week}},fields);
        await methods.sendMessageByType('chrono',{chat:{id:chats.reports_week}},fields);
        await methods.sendMessageByType('compare',{chat:{id:chats.reports_week}},fields);
    }
    //По дням
    if(moment().format('HH-mm-ss')==='00-00-01')
    {
        await methods.sendMsg(chats.reports_day,`Отчёт на ${moment().subtract(1,'day').format('YYYY-MM-DD')}`);
        let fields= {
            request_type:'day',
            from:moment().subtract(1,"day").startOf('day').format('YYYY-MM-DD')
        };
        await methods.sendMessageByType('missed',{chat:{id:chats.reports_day}},fields);
        await methods.sendMessageByType('orders',{chat:{id:chats.reports_day}},fields);
        await methods.sendMessageByType('calls',{chat:{id:chats.reports_day}},fields);
        //await methods.sendMessageByType('managers',{chat:{id:chats.reports_day}},fields);
        await methods.sendMessageByType('chrono',{chat:{id:chats.reports_day}},fields);
    }
    //По часам
    if(moment().format('mm-ss')==='00-01'){
        let fields={
            request_type:'hours',
            days:0,
            hours:1
        };
        await methods.sendMsg(chats.reports_hour,`Отчёт на ${moment().format('YYYY-MM-DD')} с ${moment().subtract(1,'hour').format('HH:mm')} по ${moment().format('HH:mm')}`);
        await methods.sendMessageByType('orders',{chat:{id:chats.reports_hour}},fields);
        await methods.sendMessageByType('calls',{chat:{id:chats.reports_hour}},fields);
    }
}, 1000);

module.exports = methods;
