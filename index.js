require('dotenv').config();
// require('log-timestamp')(function() { 
//     return `[${new Date().toTimeString().split(' ')[0]}] %s`
// });

const Avanza = require('avanza');
const chalk = require('chalk');
const isWeekend = require('date-fns/isWeekend');
const set = require('date-fns/set');
const isBefore = require('date-fns/isBefore');
const isAfter = require('date-fns/isAfter');

const cache = require('./modules/cache');
const buyer = require('./buyer');
const seller = require('./seller');

const MIN_RUN_INTERVAL = 15000;

const avanza = new Avanza();

const doWork = async function doWork(avanza){
    const now = new Date();
    const open = set(new Date(), {
        hours: 7,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
    });
    const close = set(new Date(), {
        hours: 15,
        minutes: 30,
        seconds: 0,
        milliseconds: 0,
    });
    
    if(isWeekend(now)){
        console.log(`It's weekend, let's not run anything`);
        
        return false;
    }
    
    if(isBefore(now, open)){
        console.log(`It's before opening, let's not run anything`);
        
        return false;
    }
    
    if(isAfter(now, close)){
        console.log(`It's after closing, let's not run anything`);
        
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
