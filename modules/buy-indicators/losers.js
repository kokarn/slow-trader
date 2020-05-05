const EventEmitter = require('events');

const got = require('got');
const cheerio = require('cheerio');
const format = require('date-fns/format');
const sub = require('date-fns/sub');
const addMinutes = require('date-fns/addMinutes');
const isBefore = require('date-fns/isBefore');

const DATA_URL = 'https://www.avanza.se/aktier/vinnare-forlorare.html?countryCode=SE&marketPlaceCodes=XSTO&timeUnit=TODAY';
const MIN_TIME_ON_LIST_MINUTES = 3;
const CHECK_INTERVAL_MS = 30000;

class LosersIndicator extends EventEmitter {
    constructor(){
        super();
        
        this.dataList = {};
        this.buyOrderCache = {};
        
        this.setup();
    }

    async getLosers (){
        let response;
        let losers = [];
        try {
            response = await got(DATA_URL);
        } catch (dataLoadError){
            console.error(dataLoadError);
        }
        
        const $ = cheerio.load(response.body);
        
        $('#contentTableWrapper .column.grid_5')
            .eq(1)
            .find('tbody tr')
            .each((index, element) => {
                const $element = $(element);
                const stockData = {};
                
                stockData.name = $element.find('.link').text().trim();
                stockData.changePercent = Number($element.find('.positive.changePercent').text().trim().replace(',', '.'));
                stockData.lastPrice = Number($element.find('.lastPrice.last').text().trim().replace(',', '.'));
                stockData.id = $element.find('.link').attr('href').match(/om-aktien.html\/(\d+)\//)[1];
                
                losers.push(stockData);
            });
            
        return losers;
    }
    
    async setup() {
        console.log('Setting up "losers" buy indicator');
        const todayString = format(new Date(), 'yyyy-MM-dd');
        let data = false;
        
        try {
            data = await this.getLosers();
        } catch (dataError){
            console.error(dataError);
            
            return false;
        }
        
        if(!this.buyOrderCache[todayString]){
            this.buyOrderCache[todayString] = [];
        }
        
        for(const loser of data){
            this.dataList[loser.id] = {
                ...loser,
                added: sub(new Date(), {
                    minutes: 10,
                }),
            };
            
            this.buyOrderCache[todayString].push(loser.id);
        }
        
        setInterval(this.updateData.bind(this), CHECK_INTERVAL_MS);
    }
    
    async updateData(){
        let losers = false;
        const todayString = format(new Date(), 'yyyy-MM-dd');
        console.log(`Updating loser data`);
        
        try {
            losers = await this.getLosers();
        } catch (dataError){
            console.error(dataError);
            
            return false;
        }
        
        const dataCopy = {
            ...this.dataList,
        };
        
        for(const loser of losers){
            if(!dataCopy[loser.id]){
                dataCopy[loser.id] = {
                    ...loser,
                    added: new Date(),
                    onList: true,
                };
                
                continue;
            }
            
            dataCopy[loser.id].onList = true;
            
            if(!this.buyOrderCache[todayString]){
                this.buyOrderCache[todayString] = [];
            }
            
            if(this.buyOrderCache[todayString].includes(loser.id)){
                // console.log(`New item already bought this time, let's not buy again`);
                
                continue;
            }
            
            if(isBefore(new Date(), addMinutes(loser.added, MIN_TIME_ON_LIST_MINUTES))){
                // console.log(`New item hasn't been long enough on the list, not buying yet`);
                
                continue;
            }
            
            this.buyOrderCache[todayString].push(loser.id);
            console.log(`Found a buying target from losers, ${loser.name}`);
            this.emit('buy', loser);
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

module.exports = LosersIndicator;
