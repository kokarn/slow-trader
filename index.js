const Avanza = require('avanza');
const chalk = require('chalk');
const cron = require('node-cron');
const swedishHoliday = require('swedish-holidays');

const cache = require('./modules/cache');
const isOpen = require('./modules/is-open');
const Strategy = require('./modules/strategy');

const strategies = require('./strategies.json');

const MIN_RUN_INTERVAL = 15000;
const START_CRON_STRING = '55 8 * * Monday,Tuesday,Wednesday,Thursday,Friday';
const STOP_CRON_STRING = '35 17 * * Monday,Tuesday,Wednesday,Thursday,Friday';

const avanza = new Avanza();

if(!cron.validate(START_CRON_STRING)){
    console.error(`"${START_CRON_STRING}" is not a valid cron string, exiting`);
    process.exit(1);
}

if(!cron.validate(STOP_CRON_STRING)){
    console.error(`"${STOP_CRON_STRING}" is not a valid cron string, exiting`);
    process.exit(1);
}

let currentStrategies = [];

const start = async function start(){
    console.log(new Date());
    console.log('Starting all strategies');
    
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
    
    for(const strategyConfig of strategies){
        const newStrategy = new Strategy(strategyConfig, avanza);
        
        newStrategy.start();
        currentStrategies.push(newStrategy);
    }
};

const stop = function stop(){
    console.log(new Date());
    console.log('Stopping all strategies');
    
    for(const strategy of currentStrategies){
        strategy.stop();
    }
    
    currentStrategies = [];
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
