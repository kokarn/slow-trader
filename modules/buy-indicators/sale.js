const EventEmitter = require('events');

const Avanza = require('avanza');

const avanzaProxy = require('../avanza-proxy');

class SaleIndicator extends EventEmitter {
    constructor(){
        super();
        
        this.setup();
    }
    
    async setup() {
        console.log('Setting up "sale" buy indicator');
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
        
        accountsIds.sort();
        
        console.log('Setting up subscription for deals');
        avanzaProxy.subscribe(Avanza.DEALS, `_${accountsIds.join(',')}`, (dealEvent) => {
            if(dealEvent.deals[0].orderType === 'Sälj'){
                this.emit('buy');
            }
        });
    }
    
    stop(){
        return true;
    }
}

module.exports = SaleIndicator;
