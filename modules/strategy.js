const Avanza = require('avanza');

const streamSeller = require('./stream-seller');
const streamProxy = require('./stream-proxy');
const buyIndicators = require('./buy-indicators');
const buyer = require('./buyer');

class Strategy {
    constructor(strategyConfig, avanza){
        this.avanza = avanza;
        
        this.name = strategyConfig.name;
        this.accountId = strategyConfig.isk;
        this.buyIndicators = strategyConfig.buyIndicators.split(',');
        this.sellThreshold = strategyConfig.sellThreshold;
        this.buyEventHandler = buyer.bind(this, this.avanza, this.accountId);
        this.initiatedIndicators = [];
    }
    
    async start() {
        console.log(`Starting strategy ${this.name}`);
        
        let accountOverview;
        try {
            accountOverview = await this.avanza.getOverview();
        } catch (overviewError){
            console.error(overviewError);
            
            return false;
        }
        
        let accountsIds = [];
        
        for(const account of accountOverview.accounts){
            accountsIds.push(account.accountId);
        }
        
        console.log('Setting up subscription for deals');
        this.avanza.subscribe(Avanza.DEALS, `_${accountsIds.join(',')}`, (dealEvent) => {
            console.log('Got a deal event');
            console.log(JSON.stringify(dealEvent, null, 4));
            
            if(dealEvent.deals[0].orderType === 'Sälj'){
                // We've sold something, let's buy something new
                // buyer(this.avanza);
            } else if (dealEvent.deals[0].orderType === 'Köp'){
                // We've bought something, let's sell it
                streamSeller(this.avanza, this.accountId, dealEvent.deals[0].orderbook.id, dealEvent.deals[0].orderbook.name);
            } else {
                console.error(`Unknown event type ${dealEvent.deals[0].orderType}`);
            }
        });
        
        for(const indicator of this.buyIndicators){
            const newIndiator = new buyIndicators[indicator](this.avanza);
            
            newIndiator.on('buy', this.buyEventHandler);
            
            this.initiatedIndicators.push(newIndiator);
        }
        
        let positionOverview;
        try {
            positionOverview = await this.avanza.getPositions();
        } catch (overviewError){
            console.error(overviewError);
            
            return false;
        }
        
        for(const position of positionOverview.instrumentPositions[0].positions){
            if(position.accountId !== this.accountId){
                continue;
            }
            
            streamSeller(this.avanza, position.orderbookId, position.name);
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
