require('dotenv').config();
// require('log-timestamp')(function() { 
//     return `[${new Date().toTimeString().split(' ')[0]}] %s`
// });

const Avanza = require('avanza');
const chalk = require('chalk');

const cache = require('./modules/cache');
const buyer = require('./buyer');
const seller = require('./seller');
const isOpen = require('./modules/is-open');

const MIN_RUN_INTERVAL = 15000;

const avanza = new Avanza();

const doWork = async function doWork(avanza){
    if(!isOpen()){
        return false;
    }
    
    let orderbook;
    try {
        orderbook = await avanza.getDealsAndOrders();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    let activeOrderIds = [];
    
    for(const order of orderbook.orders){
        if(order.account.id !== process.env.AVANZA_ISK_ID){
            continue;
        }
        
        activeOrderIds.push(order.orderbook.id);
    }
    
    await seller(avanza, activeOrderIds);
    await buyer(avanza, activeOrderIds);
    
    return true;
};

( async () => {
    let lastRun = await cache.get('lastRun');
    if(!lastRun){
        cache.set('lastRun', new Date());
    } else if(new Date() - new Date(lastRun) < MIN_RUN_INTERVAL){
        console.log(chalk.yellow(`You gotta wait at least ${MIN_RUN_INTERVAL}ms between runs. ${MIN_RUN_INTERVAL - (new Date() - new Date(lastRun))}ms to go`));
        
        return false;
    }
    
    try {
        await avanza.authenticate({
            username: process.env.AVANZA_USERNAME,
            password: process.env.AVANZA_PASSWORD,
            totpSecret: process.env.AVANZA_TOTP_SECRET,
          });
    } catch (authenticationError){
        console.error(authenticationError);
        
        return false;
    }
    
    cache.set('lastRun', new Date());
    
    doWork(avanza);
    
    setInterval(doWork.bind(this, avanza), 57000);
})();

process.on('SIGINT', () => {
    avanza.disconnect();
    process.exit();
});
