process.env.NTBA_FIX_319 = 1;
const express = require('express');
const bot = require('./bot/bot.js');
const app = express();
const port = 9876;
const chatid = '-449604345';
const moment = require('moment'); // require
moment.locale('ru');

const informerRouter = require('./routes/informer.js');
const wbPhonesRouter = require('./routes/wbPhones.js');

app.use(express.json({limit: '50mb', extended: true})); // for parsing application/json

app.use('/informer', informerRouter);
app.use('/wbphones', wbPhonesRouter);


app.listen(port, function () {
    console.log(`Сервер запущен на ${port} порту`);
});


