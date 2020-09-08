const API = require('../analytics/data-manager.js');

function randomIntFromInterval(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function randData (){
  return randomIntFromInterval(0, 10000)
}

function randDataSet(length) {
    let dataSet = [];
    for(let i = 0; i < length; i++){
        dataSet.push(randData());
    }
    return dataSet;
}



class ChartBuilder {
    constructor(data = null) {
        if(data !== null && typeof data === 'object' && data.length > 0)
            throw new Error('Введенное значение не является массивом');
        this.data = data;
        this.dataLeft = null;
        this.dataRight = null;
        this.options = {
            maxSymbolCount: 20,
            symbol: '|',
            emptySymbol: '.',
            label:{
                maxLength: 8,
                padding: ' '
            },
            argument:{
                maxLength: 0,
                padding: ' ',
            }

        }
    }

    setOption(optionName, optionValue) {
        this.options[optionName] = optionValue;
    }

    renderPadding(length){
        let padding = '';
        for (let i = 0; i < length; i++){
            padding+= ' ';
        }
        return padding;
    }

    renderBar(value, options = null) {
        try{
            let bar = '';
            for(let i = 0; i < this.options.maxSymbolCount; i++){
                if(i < value)
                    bar+= this.options.symbol;
                else
                    bar+= this.options.emptySymbol;
            }
            console.log(options);
            if(options){
                if(options.reversed){
                    bar = bar.split('').reverse().join('');
                }
            }
            return bar;
        }catch (e) {
            console.log('Ошибка при построении столбца', e);
        }
    }

    renderLabel(labelValue = '', options = null) {
        let label = labelValue;

        if(typeof labelValue === 'number'){

            if(labelValue > 1000000000){
                label = (labelValue/1000000000).toFixed(3) + 'kkk';
            }else if(labelValue > 1000000){
                label = (labelValue/1000000).toFixed(2) + 'kk';
            }else if(labelValue> 1000){
                label = (labelValue/1000).toFixed(1) + 'k';
            }
        }
        const labelLength = label.toString().length;
        const paddingRight = this.renderPadding(this.options.label.maxLength - labelLength);
        if(options){
            if(options.reversed){
                return `${paddingRight}${label}${this.options.label.padding}`;
            }
        }
        return `${this.options.label.padding}${label}${paddingRight}`;
    }

    renderArgument(argVal){
        let argument = `${this.options.argument.padding}${argVal}`;
        for(let i = 0; i < this.options.argument.maxLength; i++){
            argument+= ' ';
        }
        // argument+= this.options.argument.padding;
        return argument;
    }

    calcMaxArgumentLength(argArr){
        argArr.map(arg => {
            if(arg.length > this.options.argument.maxLength)
                this.options.argument.maxLength = arg.length;
        })
    }

    renderBarWithLabel(value, label = value, argument = '', options = null) {
        let bar = `${argument}${this.renderBar(value)}${this.renderLabel(label)}`;
        if(options){
            if(options.reversed){
                bar = `${this.renderLabel(label, options)}${this.renderBar(value, options)}${argument}`;
            }
        }
        return bar;
    }

    renderTitle(title){
        const fullLength = this.options.maxSymbolCount + this.options.label.maxLength + this.options.argument.maxLength;

    }

    renderChart(dataSet, options = null) {

        let chart = '';

        const calcBarVal = (val, maxVal) => {
            const tick = maxVal/this.options.maxSymbolCount;
            let barVal = 0;
            if(val < tick)
                return 0;
            for(let i = 0; i <= this.options.maxSymbolCount; i++){
                if(val >= i*tick){
                    barVal = i;
                }
            }
            return barVal;
        };
        const values = dataSet.reduce((accum, item)=>{
            accum.push(item.val);
            return accum;
        }, []);
        const args = dataSet.reduce((accum, item)=>{
            accum.push(item.arg);
            return accum;
        }, []);
        this.calcMaxArgumentLength(args);
        if(options){
            if(options.title){

            }
        }
        dataSet.map((item)=>{
            const val = item.val;
            const arg = this.renderArgument(item.arg);
            const chartVal = calcBarVal(val, this.calcMaxVal(values));
            chart += this.renderBarWithLabel(chartVal, val, arg, options) + '\n';
        });
        return chart;
    }

    calcMaxVal(array) {
        try{
            let maxVal = 0;
            array.map((val)=>{
                val > maxVal ? maxVal = val : null;
            });
            return maxVal;
        }catch (e) {
            console.log('Ошибка при вычислении максимального значения', e);
        }
    }


}

const Chart = new ChartBuilder();
// const bar = Chart.renderBarWithLabel(8, 1234);
// console.log(bar);
(
    async ()=>{
        const leadsCount = await API.getOrdersDataByDay('01.06.2020','31.06.2020', 'sum');
        console.log(leadsCount);
        const chart = Chart.renderChart(leadsCount, {reversed: true});
        console.log(chart);
    }
)();

