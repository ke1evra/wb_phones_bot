const { GoogleSpreadsheet } = require('google-spreadsheet');
const doc = new GoogleSpreadsheet('1LP653vdPicNE_UMwlYyFqY4crKZJ8qcD56bXUu8ss6U');

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
        const rows = await sheet.getRows(sheet.rowCount > 50 ? {limit: 50, offset: sheet.rowCount - 50} : {});
        const messages = {};
        rows.map(row => {
            const d = row._rawData;
            if(!messages[d[0]])
                messages[d[0]] = {};
            messages[d[0]][d[1]] = d[2];
        });
        return messages;
    }
};

module.exports = API;
