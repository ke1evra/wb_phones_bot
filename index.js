const express = require('express');
const bot = require('./bot.js');
const app = express();
const port = 9876;
const chatid = '-449604345';
const moment = require('moment'); // require
moment.locale('ru');

const informerRouter = require('./routes/informer.js');
const wbPhonesRouter = require('./routes/wbPhones.js');

app.use(express.json()); // for parsing application/json

app.use('/informer', informerRouter);
app.use('/wbphones', wbPhonesRouter);


app.post('/wbphones', function (req, res) {
    try{
        console.log(`Запрос на /wbphones (${moment().format('DD.MM.YYYY HH:mm:ss')})`);
        const b = req.body;
        console.log(JSON.stringify(b));
        const message = `sms от ${b.src} на ${b.dst} (${moment().format('DD.MM.YYYY HH:mm:ss')})\n---------------------\n${b.body}`;
        bot.sendMessage(chatid, message).then(() => {
            console.log(`сообщение ${message} успешно отправлено в чат ${chatid}`);
            res.status(200).end()
        }).catch(e => {
            console.log(e);
        });
    }catch(e){
        console.log(e);
    }
});

app.listen(port, function () {
    console.log(`Сервер запущен на ${port} порту`);
});


