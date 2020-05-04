const Avanza = require('avanza');

const streamSeller = require('./stream-seller');
const streamProxy = require('./stream-proxy');
const buyIndicators = require('./buy-indicators');
const buyer = require('./buyer');
const avanzaProxy = require('./avanza-proxy');

class Strategy {
    constructor(strategyConfig){
        this.name = strategyConfig.name;
        this.accountId = strategyConfig.isk.toString();
        this.buyIndicators = strategyConfig.buyIndicators.split(',');
        this.sellThreshold = strategyConfig.sellThreshold;
        this.buyEventHandler = buyer.bind(this, this.accountId, this.sellThreshold);
        this.initiatedIndicators = [];
    }
    
    async start() {
        console.log(`Starting strategy ${this.name}`);
        
        let accountOverview;
        try {
            accountOverview = await avanzaProxy.getOverview();
        } catch (overviewError){
            console.error(overviewError);
            
            return false;
        }
        
        let accountsIds = [];
        
        for(const account of accountOverview.accounts){
            accountsIds.push(account.accountId);
        }
        
        console.log('Setting up subscription for deals');
        avanzaProxy.subscribe(Avanza.DEALS, `_${accountsIds.join(',')}`, (dealEvent) => {
            console.log('Got a deal event');
            console.log(JSON.stringify(dealEvent, null, 4));
            
            if(dealEvent.deals[0].orderType === 'Köp'){
                // We've bought something, let's sell it
                streamSeller(this.accountId, this.sellThreshold, dealEvent.deals[0].orderbook.id, dealEvent.deals[0].orderbook.name);
            }
        });
        
        for(const indicator of this.buyIndicators){
            const newIndiator = new buyIndicators[indicator]();
            
            newIndiator.on('buy', this.buyEventHandler);
            
            this.initiatedIndicators.push(newIndiator);
        }
        
        let positionOverview;
        try {
            positionOverview = await avanzaProxy.getPositions();
        } catch (overviewError){
            console.error(overviewError);
            
            return false;
        }
        
        for(const position of positionOverview.instrumentPositions[0].positions){
            if(position.accountId !== this.accountId){
                continue;
            }
            
            streamSeller(this.accountId, this.sellThreshold, position.orderbookId, position.name);
        }
    }
    
    stop() {
        console.log(`Stopping strategy ${this.name}`);
        for(const indicator of this.initiatedIndicators){
            indicator.removeListener('buy', this.buyEventHandler);
        }
        
        streamProxy.clear();
    }
}

module.exports = Strategy;
