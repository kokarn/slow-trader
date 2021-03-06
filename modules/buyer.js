const Avanza = require('avanza');
const Notifyy = require('node-notifyy');
const chalk = require('chalk');
const endOfToday = require('date-fns/endOfToday');
const format = require('date-fns/format');
const add = require('date-fns/add');

const cache = require('./cache');
const targetFinder = require('./target-finder');
const avanzaProxy = require('./avanza-proxy');

const notifyy = new Notifyy( {
    users: 'QBfmptGTgQoOS2gGOobd5Olfp31hTKrG',
} );

module.exports = async function buyer(accountId, sellThreshold, buyTarget = false){
    console.log('Running buyer');
    
    if(!buyTarget){
        try {
            buyTarget = await targetFinder(accountId);
        } catch (buyTargetError){
            console.error(buyTargetError);
        }
    }
    
    if(!buyTarget){
        console.error(`Found no buying target`);
        
        return true;
    }
    
    let accountOverview;
    try {
        accountOverview = await avanzaProxy.getAccountOverview(accountId);
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
        validUntil: format(endOfToday(), 'yyyy-MM-dd'),
        volume: Math.floor(accountOverview.buyingPower / buyTarget.lastPrice),
        sellThreshold: sellThreshold,
    };
    
    console.log(chalk.green('Posting buy order'));
    
    let orderResponse;
    try {
        orderResponse = await avanzaProxy.placeOrder(order);
    } catch (orderError){
        console.error(orderError);
        
        return false;
    }
    
    if(!orderResponse){
        return false;
    }
    
    if(orderResponse.status === 'REJECTED'){       
        if(orderResponse.messages[0] === 'Detta värdepapper går endast att sälja.'){
            await cache.add('ignoreList', {
                id: buyTarget.id,
                end: add(new Date(), {
                    years: 1,
                }),
            });
        }
        
        return false;
    }
    
    if(orderResponse.status === 'SUCCESS'){
        try {
            await notifyy.send( {
                message: '```' + JSON.stringify(order, null, 4) + '```',
                title: `New buy order for ${buyTarget.name} posted`,
                cache: 'false',
            } );
        } catch (notifyyError){
            console.error(notifyyError);
        }
    }
    
    console.log(JSON.stringify(orderResponse, null, 4));
    
    return true;
};
