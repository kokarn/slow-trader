const EventEmitter = require('events');

const got = require('got');
const cheerio = require('cheerio');
const format = require('date-fns/format');
const sub = require('date-fns/sub');
const addSeconds = require('date-fns/addSeconds');
const isBefore = require('date-fns/isBefore');

const DATA_URL = 'https://www.avanza.se/aktier/vinnare-forlorare.html?countryCode=SE&marketPlaceCodes=XSTO&timeUnit=TODAY';
const MIN_TIME_ON_LIST_SECONDS = 45;
const CHECK_INTERVAL_MS = 20000;

class WinnersIndicator extends EventEmitter {
    constructor(){
        super();
        
        this.dataList = {};
        this.buyOrderCache = {};
        
        this.setup();
    }

    async getWinners (){
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
        console.log('Setting up "winners" buy indicator');
        const todayString = format(new Date(), 'yyyy-MM-dd');
        let data = false;
        
        try {
            data = await this.getWinners();
        } catch (dataError){
            console.error(dataError);
            
            return false;
        }
        
        if(!this.buyOrderCache[todayString]){
            this.buyOrderCache[todayString] = [];
        }
        
        for(const winner of data){
            this.dataList[winner.id] = {
                ...winner,
                added: sub(new Date(), {
                    minutes: 10,
                }),
            };
            
            this.buyOrderCache[todayString].push(winner.id);
        }
        
        setInterval(this.updateData.bind(this), CHECK_INTERVAL_MS);
    }
    
    async updateData(){
        let winners = false;
        const todayString = format(new Date(), 'yyyy-MM-dd');
        console.log(`Updating winner data`);
        
        try {
            winners = await this.getWinners();
        } catch (dataError){
            console.error(dataError);
            
            return false;
        }
        
        const dataCopy = {
            ...this.dataList,
        };
        
        for(const winner of winners){
            if(!dataCopy[winner.id]){
                dataCopy[winner.id] = {
                    ...winner,
                    added: new Date(),
                    onList: true,
                };
                
                continue;
            }
            
            dataCopy[winner.id].onList = true;
            
            if(!this.buyOrderCache[todayString]){
                this.buyOrderCache[todayString] = [];
            }
            
            if(this.buyOrderCache[todayString].includes(winner.id)){
                // console.log(`New item already bought this time, let's not buy again`);
                
                continue;
            }
            
            if(isBefore(new Date(), addSeconds(winner.added, MIN_TIME_ON_LIST_SECONDS))){
                // console.log(`New item hasn't been long enough on the list, not buying yet`);
                
                continue;
            }
            
            this.buyOrderCache[todayString].push(winner.id);
            console.log(`Found a buying target from winners, ${winner.name}`);
            this.emit('buy', winner);
        }
        
        for(const instrumentId in dataCopy){
            if(dataCopy[instrumentId].onList){
                dataCopy[instrumentId].onList = false;
                
                continue;
            }
            
            Reflect.deleteProperty(dataCopy, instrumentId);
            
            if(this.buyOrderCache[todayString].indexOf(instrumentId) === -1){
                continue;
            }
            
            this.buyOrderCache[todayString].splice(this.buyOrderCache[todayString].indexOf(instrumentId), 1);
        }
        
        this.dataList = dataCopy;
    }
}

module.exports = WinnersIndicator;
