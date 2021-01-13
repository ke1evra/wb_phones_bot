const { GoogleSpreadsheet } = require('google-spreadsheet');
const doc = new GoogleSpreadsheet('1LP653vdPicNE_UMwlYyFqY4crKZJ8qcD56bXUu8ss6U');

const API = {
    async login(){
        return await doc.useServiceAccountAuth(require('./dolgovapi-955301a7af9e.json'));
    },
    ///Чистка излишков сообщений
    async cleanUp(sheet)
    {
        const rowsNumber=50;//максимальное число строк
        try {
            let cycle_count=0;
            while (sheet.rowCount > rowsNumber) {
                cycle_count++;
                if(cycle_count>10000){console.log(`Ошибка в функции API.cleanUp():Зацикливание`);break;};
                await sheet.rows[1].delete();
                for (let i = 1; i < sheet.rowCount; i++) {
                    sheet.rows[i] = sheet.rows[i + 1];
                    await sheet.rows[i].save();
                }
            }
        }
        catch(e){console.log(`Ошибка в функции API.cleanUp():${e}`)};
    },
    async addRow(chat_id, message_id, message){
        await this.login();
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow({ chat_id, message_id, message });
        await this.cleanUp(sheet);
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
