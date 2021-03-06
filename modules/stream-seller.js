const Avanza = require('avanza');
const Notifyy = require('node-notifyy');
const chalk = require('chalk');
const startOfTomorrow = require('date-fns/startOfTomorrow');
const format = require('date-fns/format');
const add = require('date-fns/add');

const cache = require('./cache');
const getOwnership = require('./get-ownership');
const streamProxy = require('./stream-proxy');
const avanzaProxy = require('./avanza-proxy');

const notifyy = new Notifyy( {
    users: process.env.NOTIFYY_USERS,
} );

const BUY_TIMEOUT_MINUTES = 5;
const RETRY_TIMEOUT = 30000;

module.exports = async function seller(accountId, sellThreshold, instrumentId, instrumentName){
    console.log(`Setting up seller for ${instrumentName} with a target of ${sellThreshold}% profit`);
    
    let instrumentOwnership;
    try {
        instrumentOwnership = await getOwnership(accountId, instrumentId);
    } catch (ownershipError) {
        console.error(ownershipError);
        
        return false;
    }
    
    if(!instrumentOwnership){
        console.error(`Found no ${instrumentName} on account ${accountId}, stopping seller setup`);
        console.log(`Trying again in ${RETRY_TIMEOUT}ms`);
        
        setTimeout(seller.bind(this, accountId, sellThreshold, instrumentId, instrumentName), RETRY_TIMEOUT);
        
        return false;
    }
    
    const streamId = streamProxy.add(instrumentId, async (tradeUpdate) => {
        if(!tradeUpdate.price){
            console.log(`No sell price for ${instrumentName}, exchange is probably closed`);
            
            return false;
        }
        
        const profitPercent = tradeUpdate.price / instrumentOwnership.averageAcquiredPrice * 100 - 100;
        
        if(profitPercent < sellThreshold){
            if(profitPercent < 0){
                console.log(`Profit currently at ${chalk.red(+profitPercent.toFixed(2))}% for ${instrumentName} which is lower than ${sellThreshold}%, not selling right now`);
            } else {
                console.log(`Profit currently at ${chalk.yellow(+profitPercent.toFixed(2))}% for ${instrumentName} which is lower than ${sellThreshold}%, not selling right now`);
            }
            
            return false;
        }
        
        console.log(`Profit currently at ${chalk.green(+profitPercent.toFixed(2))}% for ${instrumentName} which is higher than ${sellThreshold}%, selling right now`);
        
        const order = {
            accountId: accountId,
            orderbookId: instrumentOwnership.orderbookId,
            orderType: Avanza.SELL,
            price: tradeUpdate.price,
            validUntil: format(startOfTomorrow(), 'yyyy-MM-dd'),
            volume: instrumentOwnership.volume,
        };
        
        console.log(chalk.green('Posting sell order'));
        
        streamProxy.pause(instrumentId, streamId);
        
        let orderResponse;
        try {
            orderResponse = await avanzaProxy.placeOrder(order);
        } catch (orderError){
            console.error(orderError);
            streamProxy.unpause(instrumentId, streamId);
            
            return false;
        }
        
        try {
            notifyy.send( {
                message: '```' + JSON.stringify(order, null, 4) + '```',
                title: `New sell order for ${instrumentOwnership.name} posted`,
                cache: 'false',
            } );
        } catch (notifyyError){
            console.error(notifyyError);
        }
        
        if(orderResponse.status === 'REJECTED'){
            console.error(orderResponse);
            streamProxy.unpause(instrumentId, streamId);
            
            return true;
        }
        
        console.log(JSON.stringify(orderResponse, null, 4));
        
        cache.add('ignoreList', {
            id: instrumentOwnership.orderbookId,
            end: add(new Date(), {
                minutes: BUY_TIMEOUT_MINUTES,
            }),
        });
        
        console.log(`Closing seller for ${instrumentName}`);
        streamProxy.unpause(instrumentId, streamId);
        streamProxy.remove(instrumentId, streamId);
    });
};
