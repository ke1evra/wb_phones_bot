const { GoogleSpreadsheet } = require('google-spreadsheet');

// spreadsheet key is the long id in the sheets URL
const doc = new GoogleSpreadsheet('1LP653vdPicNE_UMwlYyFqY4crKZJ8qcD56bXUu8ss6U');


// doc.useApiKey('AIzaSyBkvrBiFJ0LzZzbkVqmPvUzOqiVZmPsUws');

// await doc.loadInfo(); // loads document properties and worksheets
// console.log(doc.title);
// await doc.updateProperties({ title: 'renamed doc' });
//
// const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id]
// console.log(sheet.title);
// console.log(sheet.rowCount);

const API = {
    async login(){
        return await doc.useServiceAccountAuth(require('./dolgovapi-955301a7af9e.json'));
    },
    async addRow(chat_id, message_id, message){
        await this.login();
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow({ chat_id, message_id, message });
    },
    async getMessages(){
        await this.login();
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows({limit: 3, offset: sheet.rowCount - 4});
        const messages = {};

        rows.map(row => {
            // console.log(row._rawData);
            const d = row._rawData;
            messages[d[0]] = d[1];
        });
        console.log(messages);
    }
};

// (async function(){
//     try{
//         // await API.addRow();
//         await API.getMessages();
//         console.log('Успех!');
//
//
//     }catch (e) {
//         console.log('Ошибка при выполнении');
//         console.error(e);
//     }
// })();


module.exports = API;
