const express = require('express');
const router = express.Router();
const actions = require('../bot/botActions');
const moment = require('moment');

router.post('/', function (req, res) {
    try{
        console.log(`Запрос на /wbphones (${moment().format('DD.MM.YYYY HH:mm:ss')})`);
        actions.sendMessageFromZebra(req.body)
            .then(()=>{
                res.status(200).end()
            });
    }catch(e){
        console.log(e);
    }
});


module.exports = router;
