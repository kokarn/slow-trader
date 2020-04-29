const Avanza = require('avanza');
const Notifyy = require('node-notifyy');
const chalk = require('chalk');
const startOfTomorrow = require('date-fns/startOfTomorrow');
const format = require('date-fns/format');
const add = require('date-fns/add');

const cache = require('./cache');
const getOwnership = require('./get-ownership');
const streamProxy = require('./stream-proxy');

const notifyy = new Notifyy( {
    users: 'QBfmptGTgQoOS2gGOobd5Olfp31hTKrG',
} );

const MIN_PROFIT_PERCENT = 0.75;
const BUY_TIMEOUT_MINUTES = 5;

module.exports = async function seller(avanza, instrumentId, instrumentName){
    console.log(`Setting up seller for ${instrumentName}`);
    
    let instrumentOwnership;
    try {
        instrumentOwnership = await getOwnership(avanza, instrumentId);
    } catch (ownershipError) {
        console.error(ownershipError);
        
        return false;
    }
    
    const streamId = streamProxy.add(avanza, instrumentId, async (quoteUpdate) => {
        if(!quoteUpdate.sellPrice){
            console.log(`No sell price for ${instrumentName}, exchange is probably closed`);
            
            return false;
        }
        
        const profitPercent = quoteUpdate.sellPrice / instrumentOwnership.averageAcquiredPrice * 100 - 100;
        
        if(profitPercent < MIN_PROFIT_PERCENT){
            if(profitPercent < 0){
                console.log(`Profit currently at ${chalk.red(+profitPercent.toFixed(2))}% for ${instrumentName} which is lower than ${MIN_PROFIT_PERCENT}%, not selling right now`);
            } else {
                console.log(`Profit currently at ${chalk.yellow(+profitPercent.toFixed(2))}% for ${instrumentName} which is lower than ${MIN_PROFIT_PERCENT}%, not selling right now`);
            }
            
            return false;
        }
        
        console.log(chalk.green(`Should sell ${instrumentName}, profit at ${chalk.green(+profitPercent.toFixed(2))}%`));
        
        const order = {
            accountId: process.env.AVANZA_ISK_ID,
            orderbookId: instrumentOwnership.orderbookId,
            orderType: Avanza.SELL,
            price: quoteUpdate.sellPrice,
            validUntil: format(startOfTomorrow(), 'yyyy-MM-dd'),
            volume: instrumentOwnership.volume,
        };
        
        if(!order.volume || order.volume <= 0){
            console.log(`Order with 0 volume is invalid, let's not do that`);
            
            return false;
        }
        
        console.log(chalk.green('Posting sell order'));
        console.log(order);
        
        try {
            await notifyy.send( {
                message: '```' + JSON.stringify(order, null, 4) + '```',
                title: `New sell order for ${orderbookData.orderbook.name} posted`,
                cache: 'false',
            } );
        } catch (notifyyError){
            console.error(notifyyError);
        }
        
        let orderResponse;
        try {
            orderResponse = await avanza.placeOrder(order);
        } catch (orderError){
            console.error(orderError);
            
            return false;
        }
        
        if(orderResponse.status === 'REJECTED'){
            console.error(orderResponse);
            
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
        streamProxy.remove(instrumentId, streamId);
    });
};
