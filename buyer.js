const Notifyy = require('node-notifyy');
const chalk = require('chalk');
const startOfTomorrow = require('date-fns/startOfTomorrow');
const format = require('date-fns/format');
const add = require('date-fns/add');

const cache = require('./modules/cache');
const targetFinder = require('./modules/target-finder');

const notifyy = new Notifyy( {
    users: 'QBfmptGTgQoOS2gGOobd5Olfp31hTKrG',
} );

module.exports = async function buyer(avanza){
    console.log('Running buyer');
    
    let buyTarget = false;
    
    try {
        buyTarget = await targetFinder(avanza);
    } catch (buyTargetError){
        console.error(buyTargetError);
    }
    
    if(!buyTarget){
        console.error(`Found no buying target`);
        
        return true;
    }
    
    console.log(chalk.green(`Found a buying target`));
    console.log(JSON.stringify(buyTarget, null, 4 ));
    /*
    {
        "priceThreeMonthsAgo": 18.13,
        "currency": "SEK",
        "priceOneYearAgo": 13.5,
        "lastPrice": 16.08,
        "change": 0.73,
        "changePercent": 4.76,
        "updated": "2020-04-22T17:11:11.000+0200",
        "highlightValue": 28989,
        "flagCode": "SE",
        "name": "Fingerprint Cards B",
        "id": "5468"
    }
    */
    
    const order = {
        accountId: process.env.AVANZA_ISK_ID,
        orderbookId: buyTarget.id,
        orderType: 'BUY',
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
