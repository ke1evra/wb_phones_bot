function randomIntFromInterval(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function randData (){
  return randomIntFromInterval(0, 999999999)
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
                maxLength: 6,
                padding: '  '
            }

        }
    }

    setOption(optionName, optionValue) {
        this.options[optionName] = optionValue;
    }

    renderBar(value) {
        try{
            let bar = '';
            for(let i = 0; i < this.options.maxSymbolCount; i++){
                if(i < value)
                    bar+= this.options.symbol;
                else
                    bar+= this.options.emptySymbol;
            }
            return bar;
        }catch (e) {
            console.log('Ошибка при построении столбца', e);
        }
    }

    renderLabel(labelValue = '') {
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
        if(label.toString().length > this.options.label.maxLength)
            this.options.label.maxLength = labelLength;
        return `${this.options.label.padding}${label}`;
    }

    renderBarWithLabel(value, label = value) {
        return `${this.renderBar(value)}${this.renderLabel(label)}`;
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
        dataSet.map((val)=>{
            const chartVal = calcBarVal(val, this.calcMaxVal(dataSet));
            chart += this.renderBarWithLabel(chartVal, val) + '\n';
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
console.log(Chart.renderChart(randDataSet(15)));
