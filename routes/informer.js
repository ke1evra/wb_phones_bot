const express = require('express');
const router = express.Router();
const actions = require('../botActions');
const moment = require('moment');
const chats = require('../chatList.js');

router.all('/', function (req, res) {
    try{
        console.log(`Запрос на /informer (${moment().format('DD.MM.YYYY HH:mm:ss')})`);
        actions.sendMessageToManagersFromEmail(req.body)
            .then(()=>{
                res.status(200).end()
            });
    }catch(e){
        console.log(e);
    }
});

router.all('/test', function (req, res) {
    try{
        console.log(`Запрос на /informer/test (${moment().format('DD.MM.YYYY HH:mm:ss')})`);
        actions.resendEmailToChat(req.body, chats.me)
            .then(()=>{
                res.status(200).end()
            });
    }catch(e){
        console.log(e);
    }
});


module.exports = router;
