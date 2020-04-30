const EventEmitter = require('events');

const Avanza = require('avanza');

class SellIndicator extends EventEmitter {
    constructor(avanza){
        super();
        
        this.avanza = avanza;
        
        this.setup();
    }
    
    async setup() {
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
            if(dealEvent.deals[0].orderType === 'Sälj'){
                this.emit('buy');
            }
        });
    }
}

module.exports = SellIndicator;
