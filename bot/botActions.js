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
    let thisIsSpam=false
    spamList.forEach(spam =>{
      message.includes(spam) ? thisIsSpam = true : null;
    })
    if (!thisIsSpam){
      return bot
          .sendMessage(chat, message)
          .then(() => {
            console.log(`Cообщение\n"${message.slice(0,80)}"\nуспешно отправлено в чат (${chat})`);
          })
          .catch((e) => {
            console.log(e);
          });
    } else {
      console.log(`Cообщение\n"${message.slice(0,80)}"\nбыло расцененно как спам`);
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
          [{ text: "📤 Показать целиком", callback_data: "open" }],
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
        ? { text: "📥 Скрыть", callback_data: "close" }
        : { text: "📤 Показать целиком", callback_data: "open" };
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
  async checkMissedCalls(msg = null, days = 1) {
    let chat_id = msg ? msg.chat.id : chats.manager;
    const message = await menu.missed(days);
    const messageList = message.match(/[\s\S]{1,4000}/g) || [];

    const sendMsg = (message) => {
      return bot
        .sendMessage(chat_id, message)
        .then((msg) => {
          console.log(`сообщение (id: ${msg.message_id})${message} успешно отправлено в чат (${chat_id})`
          );
          return msg;
        })
        .catch((e) => {
          console.log(e);
        });
    };

    for (let message of messageList) {
      await sendMsg(message);
    }
  },
  async getManagers(msg = null, days = 1) {
    let chat_id = msg ? msg.chat.id : chats.manager;
    const message = await menu.managers(days);
    const messageList = message.match(/[\s\S]{1,4000}/g) || [];

    const sendMsg = (message) => {
      return bot
          .sendMessage(chat_id, message)
          .then((msg) => {
            console.log(
                `сообщение (id: ${msg.message_id})${message.length>80?message.slice(0,80)+'...':message} успешно отправлено в чат (${chat_id})`);
            return msg;})
          .catch((e) => {
            console.log(e);
          });
    };

    for (let message of messageList) {
      await sendMsg(message);
    }
  },
  async getExpenses(msg = null, days = 1) {
    let chat_id = msg ? msg.chat.id : chats.manager;
    const message = await menu.expenses(days);
    const messageList = message.match(/[\s\S]{1,4000}/g) || [];

    const sendMsg = (message) => {
      return bot
          .sendMessage(chat_id, message)
          .then((msg) => {
            console.log(
                `сообщение (id: ${msg.message_id})${message.length>80?message.slice(0,80)+'...':message} успешно отправлено в чат (${chat_id})`);
            return msg;})
          .catch((e) => {
            console.log(e);
          });
    };

    for (let message of messageList) {
      await sendMsg(message);
    }
  },
  async getOrders(msg = null, days = 1) {
    let chat_id = msg ? msg.chat.id : chats.manager;
    const message = await menu.orders(days);
    const messageList = message.match(/[\s\S]{1,4000}/g) || [];

    const sendMsg = (message) => {
      return bot
          .sendMessage(chat_id, message)
          .then((msg) => {
            console.log(
                `сообщение (id: ${msg.message_id})${message.length>80?message.slice(0,80)+'...':message} успешно отправлено в чат (${chat_id})`
            );
            return msg;
          })
          .catch((e) => {
            console.log(e);
          });
    };

    for (let message of messageList) {
      await sendMsg(message);
    }
  },
  async getCalls(msg = null, days = 1) {
    let chat_id = msg ? msg.chat.id : chats.manager;
    const message = await menu.calls(days);
    const messageList = message.match(/[\s\S]{1,4000}/g) || [];

    const sendMsg = (message) => {
      return bot
          .sendMessage(chat_id, message)
          .then((msg) => {
            console.log(
                `сообщение (id: ${msg.message_id})${message} успешно отправлено в чат (${chat_id})`
            );
            return msg;
          })
          .catch((e) => {
            console.log(e);
          });
    };

    for (let message of messageList) {
      await sendMsg(message);
    }
  },
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

bot.onText(/\/start/, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, menu.hello);
  } catch (e) {
    console.log(e);
  }
});

bot.onText(/^\/orders(\s.+)?/, async (msg,match) => {
  try {
    console.log("/orders");
    const days = match[1] ? match[1] : 1;
    await methods.getOrders(msg, days);
  } catch (e) {
    console.log(e);
  }
});

bot.onText(/^\/expenses(\s.+)?/, async (msg, match) => {
  try {
    console.log("/expenses");
    console.log(match);
    const days = match[1] ? match[1] : 1;
    await methods.getExpenses(msg, days);
  } catch (e) {
    console.log(e);
  }
});
bot.onText(/^\/managers(\s.+)?/, async (msg, match) => {
  try {
    console.log("/missed");
    console.log(match);
    const days = match[1] ? match[1] : 1;
    await methods.getManagers(msg, days);
  } catch (e) {
    console.log(e);
  }
});
bot.onText(/^\/missed(\s.+)?/, async (msg, match) => {
  try {
    console.log("/missed");
    console.log(match);
    const days = match[1] ? match[1] : 1;
    await methods.checkMissedCalls(msg, days);
  } catch (e) {
    console.log(e);
  }
});
bot.onText(/^\/calls(\s.+)?/, async (msg, match) => {
  try {
    console.log("/calls");
    console.log(match);
    const days = match[1] ? match[1] : 1;
    await methods.getCalls(msg, days);
  } catch (e) {
    console.log(e);
  }
});
// methods.checkMissedCalls().catch(e => console.log(e));
setInterval(async () => {
  if (moment().format("HH") > 9 && moment().format("HH") < 20) {
    await methods.checkMissedCalls();
  }
}, 60 * 60 * 1000);

module.exports = methods;
