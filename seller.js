const Avanza = require('avanza');
const Notifyy = require('node-notifyy');
const chalk = require('chalk');
const startOfTomorrow = require('date-fns/startOfTomorrow');
const format = require('date-fns/format');
const add = require('date-fns/add');

const cache = require('./modules/cache');

const notifyy = new Notifyy( {
    users: 'QBfmptGTgQoOS2gGOobd5Olfp31hTKrG',
} );

const MIN_PROFIT_PERCENT = 0.75;
const BUY_TIMEOUT_MINUTES = 5;

module.exports = async function seller(avanza, ignoreIdList){
    console.log('Running seller');
    
    let orderbookData = false;
    
    let positions;
    try {
        positions = await avanza.getPositions();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const position of positions.instrumentPositions[0].positions){
        if(position.accountId !== process.env.AVANZA_ISK_ID){
            continue;
        }
        
        if(ignoreIdList.includes(position.orderbookId)){
            console.log(`There's already an order for ${position.name}, not doing sale calculations`);
            
            continue;
        }
        
        const instrumentOwnership = position;
        try {
            orderbookData = await avanza.getOrderbook(Avanza.STOCK, instrumentOwnership.orderbookId);
        } catch (orderbookDataError){
            console.error(orderbookDataError);
        }
        
        console.log('Current ownership');
        console.log(instrumentOwnership);
        
        
        console.log('Orderbook data');
        console.log(JSON.stringify(orderbookData.orderbook, null, 4));
        
        if(!orderbookData.orderbook.sellPrice){
            console.log(`No sell price for ${instrumentOwnership.name}, exchange is probably closed`);
            
            continue;
        }
        
        const profitPercent = orderbookData.orderbook.sellPrice / instrumentOwnership.averageAcquiredPrice * 100 - 100;
        
        if(profitPercent < MIN_PROFIT_PERCENT){
            console.log(`Profit currently at ${+profitPercent.toFixed(2)}% for ${instrumentOwnership.name} which is lower than ${MIN_PROFIT_PERCENT}%, not selling right now`);
            
            continue;
        }
        
        console.log(chalk.green(`Should sell ${instrumentOwnership.name}, profit at ${+profitPercent.toFixed(2)}%`));
        
        const order = {
            accountId: process.env.AVANZA_ISK_ID,
            orderbookId: instrumentOwnership.orderbookId,
            orderType: 'SELL',
            price: orderbookData.orderbook.sellPrice,
            validUntil: format(startOfTomorrow(), 'yyyy-MM-dd'),
            volume: instrumentOwnership.volume,
        };
        
        if(!order.volume || order.volume <= 0){
            console.log(`Order with 0 volume is invalid, let's not do that`);
            
            continue;
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
            
            continue;
        }
        
        if(orderResponse.status === 'REJECTED'){
            console.error(orderResponse);
            
            continue;
        }
        
        console.log(JSON.stringify(orderResponse, null, 4));
        
        cache.add('ignoreList', {
            id: instrumentOwnership.orderbookId,
            end: add(new Date(), {
                minutes: BUY_TIMEOUT_MINUTES,
            }),
        });    
    }
    
    return true;
};
