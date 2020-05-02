const Avanza = require('avanza');
const Notifyy = require('node-notifyy');
const chalk = require('chalk');
const startOfTomorrow = require('date-fns/startOfTomorrow');
const format = require('date-fns/format');
const add = require('date-fns/add');

const cache = require('./cache');
const targetFinder = require('./target-finder');

const notifyy = new Notifyy( {
    users: 'QBfmptGTgQoOS2gGOobd5Olfp31hTKrG',
} );

module.exports = async function buyer(avanza, accountId, buyTarget = false){
    console.log('Running buyer');
    
    if(!buyTarget){
        try {
            buyTarget = await targetFinder(avanza, accountId);
        } catch (buyTargetError){
            console.error(buyTargetError);
        }
    }
    
    if(!buyTarget){
        console.error(`Found no buying target`);
        
        return true;
    }
    
    let positions;
    try {
        positions = await avanza.getPositions();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    console.log(chalk.green(`Found a buying target`));
    console.log(JSON.stringify(buyTarget, null, 4 ));
    
    const order = {
        accountId: accountId,
        orderbookId: buyTarget.id,
        orderType: Avanza.BUY,
        price: buyTarget.lastPrice,
        validUntil: format(startOfTomorrow(), 'yyyy-MM-dd'),
        volume: Math.floor(positions.totalBuyingPower / buyTarget.lastPrice),
    };
    
    console.log(chalk.green('Posting buy order'));
    console.log(order);
    
    try {
        await notifyy.send( {
            message: '```' + JSON.stringify(order, null, 4) + '```',
            title: `New buy order for ${buyTarget.name} posted`,
            cache: 'false',
        } );
    } catch (notifyyError){
        console.error(notifyyError);
    }
    
    try {
        const orderResponse = await avanza.placeOrder(order);
        
        if(orderResponse.status === 'REJECTED'){
            console.error(orderResponse);
            
            if(orderResponse.messages[0] === 'Detta värdepapper går endast att sälja.'){
                await cache.add('ignoreList', {
                    id: buyTarget.id,
                    end: add(new Date(), {
                        years: 1,
                    }),
                });
            }
        } else {
            console.log(JSON.stringify(orderResponse, null, 4));
        }
    } catch (orderError){
        console.error(orderError);
    }
    
    return true;
};
