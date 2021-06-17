const chalk = require('chalk');
const CronJob = require('cron').CronJob;
const swedishHoliday = require('swedish-holidays');

const cache = require('./modules/cache');
const isOpen = require('./modules/is-open');
const Strategy = require('./modules/strategy');
const avanzaProxy = require('./modules/avanza-proxy');
const dockerSecret = require('./modules/docker-secret');

const strategies = require('./strategies.json');

const MIN_RUN_INTERVAL = 20000;
const START_CRON_STRING = '55 8 * * Mon,Tue,Wed,Thu,Fri';
const STOP_CRON_STRING = '35 17 * * Mon,Tue,Wed,Thu,Fri';

let currentStrategies = [];

process.env.AVANZA_PASSWORD = dockerSecret('AVANZA_PASSWORD');
process.env.AVANZA_TOTP_SECRET = dockerSecret('AVANZA_TOTP_SECRET');
// process.env.AVANZA_USERNAME = dockerSecret('AVANZA_USERNAME');
// process.env.NOTIFYY_USERS = dockerSecret('NOTIFYY_USERS');


const start = async function start(){
    console.log(new Date());
    console.log('Starting all strategies');

    await avanzaProxy.connect();

    for(const strategyConfig of strategies){
        const newStrategy = new Strategy(strategyConfig);

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
    avanzaProxy.disconnect();
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

    const openJob = new CronJob(
        START_CRON_STRING,
        () => {
            if(swedishHoliday.isHoliday()){
                // Don't start on holidays

                return false;
            }

            start();
        },
        null,
        true,
        'Europe/Stockholm'
    );

    const closeJob = new CronJob(
        STOP_CRON_STRING,
        () => {
            stop();
        },
        null,
        true,
        'Europe/Stockholm'
    );
})();

process.on('SIGINT', () => {
    stop();

    process.exit();
});
