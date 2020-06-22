const express = require('express');
const bot = require('./bot.js');
const app = express();
const port = 9876;
const chatid = '-449604345';

app.get('/wbphones', function (req, res) {
    console.log('Запрос на /wbphones');
    let q = req.query;
    bot.sendMessage(chatid, JSON.stringify(q)).then(() => {
        console.log(`сообщение ${q} успешно отправлено в чат ${chatid}`);
        res.status(200).end()
    }).catch(e => {
        console.log(e);
    }); 

});

app.listen(port, function () {
    console.log(`Сервер запущен на ${port} порту`);
});


