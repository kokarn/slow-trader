const EventEmitter = require('events');

const got = require('got');
const cheerio = require('cheerio');
const format = require('date-fns/format');
const differenceInMinutes = require('date-fns/differenceInMinutes');

const DATA_URL = 'https://www.avanza.se/aktier/vinnare-forlorare.html';
const MIN_TIME_ON_LIST_MINUTES = 5;
const CHECK_INTERVAL_MS = 60000;

class WinnersIndicator extends EventEmitter {
    constructor(){
        super();
        
        this.dataList = {};
        this.buyOrderCache = {};
        
        this.setup();
    }

    async getData (){
        let response;
        let winners = [];
        try {
            response = await got(DATA_URL);
        } catch (dataLoadError){
            console.error(dataLoadError);
        }
        
        const $ = cheerio.load(response.body);
        
        $('#contentTableWrapper .column.grid_5')
            .first()
            .find('tbody tr')
            .each((index, element) => {
                const $element = $(element);
                const stockData = {};
                
                stockData.name = $element.find('.link').text().trim();
                stockData.changePercent = Number($element.find('.positive.changePercent').text().trim().replace(',', '.'));
                stockData.lastPrice = Number($element.find('.lastPrice.last').text().trim().replace(',', '.'));
                stockData.id = $element.find('.link').attr('href').match(/om-aktien.html\/(\d+)\//)[1];
                
                winners.push(stockData);
            });
            
        return winners;
    }
    
    async setup() {
        let data = false;
        
        try {
            data = await this.getData();
        } catch (dataError){
            console.error(dataError);
            
            return false;
        }
        
        for(const winner of data){
            this.dataList[winner.id] = {
                ...winner,
                added: new Date(),
            };
        }
        
        setInterval(this.updateData.bind(this), CHECK_INTERVAL_MS);
    }
    
    async updateData(){
        let data = false;
        const todayString = format(new Date(), 'yyyy-MM-dd');
        
        try {
            data = await this.getData();
        } catch (dataError){
            console.error(dataError);
            
            return false;
        }
        
        const dataCopy = {
            ...this.dataList,
        };
        
        for(const winner of data){
            if(!dataCopy[winner.id]){
                continue;
            }
            
            dataCopy[winner.id].onList = true;
            
            if(!this.buyOrderCache[todayString]){
                this.buyOrderCache[todayString] = [];
            }
            
            if(this.buyOrderCache[todayString].includes(winner.id)){
                continue;
            }
            
            if(differenceInMinutes(new Date(), winner.added) <= MIN_TIME_ON_LIST_MINUTES){
                continue;
            }
            
            this.buyOrderCache[todayString].push(winner.id);
            
            this.emit('buy', winner);
        }
        
        for(const instrumentId in dataCopy){
            if(dataCopy[instrumentId].onList){
                continue;
            }
            
            Reflect.deleteProperty(dataCopy, instrumentId);
        }
        
        this.dataList = dataCopy;
    }
}

module.exports = WinnersIndicator;
