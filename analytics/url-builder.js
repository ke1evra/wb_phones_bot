const moment = require("moment");
const API_IP = require('../constants/API_IP');
class DateRange {
  constructor(from, to) {
    this.from = this.formatDate(from);
    this.to = this.formatDate(to);
  }

  formatDate(date) {
    const dateArr = date.split(".");
    return `${dateArr[2]}-${dateArr[1]}-${dateArr[0]}`;
  }
}

class UrlBuilder {
  constructor() {}

  renderUrl(dateFrom, dateTo, uri = "orders") {
    const range = new DateRange(dateFrom, dateTo);
    console.log(range);
    return `${API_IP}/${uri}?date_from=${range.from} 00:00:00&date_to=${range.to} 23:59:59`;
  }

  renderNoMinutesUrl(from, to) {}
}

module.exports = new UrlBuilder();
