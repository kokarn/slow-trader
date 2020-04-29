require('dotenv').config();

const Avanza = require('avanza');
const chalk = require('chalk');
const cron = require('node-cron');
const swedishHoliday = require('swedish-holidays');

const cache = require('./modules/cache');
const buyer = require('./buyer');
const isOpen = require('./modules/is-open');
const streamSeller = require('./modules/stream-seller');

const MIN_RUN_INTERVAL = 15000;
const START_CRON_STRING = '55 8 * * Monday,Tuesday,Wednesday,Thursday,Friday';
const STOP_CRON_STRING = '35 17 * * Monday,Tuesday,Wednesday,Thursday,Friday';

const avanza = new Avanza();
let buyInterval = false;

if(!cron.validate(START_CRON_STRING)){
    console.error(`"${START_CRON_STRING}" is not a valid cron string, exiting`);
    process.exit(1);
}

if(!cron.validate(STOP_CRON_STRING)){
    console.error(`"${STOP_CRON_STRING}" is not a valid cron string, exiting`);
    process.exit(1);
}

const start = async function start(){
    console.log('Starting');
    
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
    
    let accountOverview;
    try {
        accountOverview = await avanza.getOverview();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    let accountsIds = [];
    
    for(const account of accountOverview.accounts){
        accountsIds.push(account.accountId);
    }
    
    console.log('Setting up subscription for deals');
    avanza.subscribe(Avanza.DEALS, `_${accountsIds.join(',')}`, (dealEvent) => {
        console.log('Got a deal event');
        console.log(JSON.stringify(dealEvent, null, 4));
        
        if(dealEvent.orderType === 'Sälj'){
            // We've sold something, let's buy something new
            buyer(avanza);
        } else if (dealEvent.orderType === 'Köp'){
            // We've bought something, let's sell it
            streamSeller(avanza, dealEvent.orderbook.id, dealEvent.orderbook.name);
        } else {
            console.error(`Unknown event type ${dealEvent.orderType}`);
        }
    });    
    
    console.log('Setting up subscription for orders');
    avanza.subscribe(Avanza.ORDERS, `_${accountsIds.join(',')}`, (orderEvent) => {
        console.log('Got an order event');
        console.log(JSON.stringify(orderEvent, null, 4));
    });
    
    let positionOverview;
    try {
        positionOverview = await avanza.getPositions();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const position of positionOverview.instrumentPositions[0].positions){
        if(position.accountId !== process.env.AVANZA_ISK_ID){
            continue;
        }
        
        streamSeller(avanza, position.orderbookId, position.name);
    }
    
    buyInterval = setInterval(() => {
        buyer(avanza);
    }, 590000);
};

const stop = function stop(){
    console.log('Stopping');
    
    clearInterval(buyInterval);
    avanza.disconnect();
};

( async () => {
    let lastRun = await cache.get('lastRun');
    if(!lastRun){
        cache.set('lastRun', new Date());
    } else if(new Date() - new Date(lastRun) < MIN_RUN_INTERVAL){
        console.log(chalk.yellow(`You gotta wait at least ${MIN_RUN_INTERVAL}ms between runs. ${MIN_RUN_INTERVAL - (new Date() - new Date(lastRun))}ms to go`));
        
        return false;
    }
    
    cache.set('lastRun', new Date());
    
    if(isOpen()){
        start();
    }

    cron.schedule(START_CRON_STRING, () => {
        if(swedishHoliday.isHoliday()){
            // Don't start on holidays
            
            return false;
        }
        
        start();
    },
    {
        timezone: 'Europe/Stockholm',
    });
    
    cron.schedule(STOP_CRON_STRING, () => {
        stop();
    },
    {
        timezone: 'Europe/Stockholm',
    });
})();

process.on('SIGINT', () => {
    stop();

    process.exit();
});
