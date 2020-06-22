const express = require('express');
const bot = require('./bot.js');
const app = express();
const port = 9876;
const chatid = '-449604345';
const moment = require('moment'); // require
moment.locale('ru');

app.get('/wbphones', function (req, res) {
    console.log('Запрос на /wbphones');
    const q = req.query;
    const b = req.body;
    console.log(JSON.stringify(b));
    const message = `sms от ${b.src} на ${b.dst} (${moment().format('LLL')})\n---------------------\n${b.body}`;
    bot.sendMessage(chatid, message).then(() => {
        console.log(`сообщение ${message} успешно отправлено в чат ${chatid}`);
        res.status(200).end()
    }).catch(e => {
        console.log(e);
    });

});

app.listen(port, function () {
    console.log(`Сервер запущен на ${port} порту`);
});


