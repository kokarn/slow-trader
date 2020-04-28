const chalk = require('chalk');
const isAfter = require('date-fns/isAfter');

const cache = require('./cache');

const MIN_QUANTITY = 1;
const INSPO_ID = 'jxGl2hfp'; //Populära aktier i Sverige

const arrayShuffle = function arrayShuffle(a){
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    
    return a;
};

module.exports = async function targetFinder(avanza){
    let inspiration;
    const ignoreList = await cache.get('ignoreList');
    
    let positions;
    try {
        positions = await avanza.getPositions();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    let positionOverview = [];
        
    for(const position of positions.instrumentPositions[0].positions){
        if(position.accountId !== process.env.AVANZA_ISK_ID){
            continue;
        }
        
        positionOverview.push(position.orderbookId);
    }
    
    try {
        inspiration = await avanza.getInspirationList(INSPO_ID);
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    arrayShuffle(inspiration.orderbooks);
    
    stockLoop:
    for(const stock of inspiration.orderbooks){
        const maxNumber = positions.totalBuyingPower / stock.lastPrice;
        
        if(maxNumber < MIN_QUANTITY){
            console.log(chalk.yellow(`Can only buy ${+maxNumber.toFixed(2)} of ${stock.name} for ${positions.totalBuyingPower} SEK, skipping`));
            
            continue;
        }
        
        if(positionOverview.includes(stock.orderbookId)){
            console.log(chalk.yellow(`Already have ${stock.name}, skipping`));
            
            continue;
        }
        
        for(let i = 0; i < ignoreList.length; i = i + 1){
            const ignore = ignoreList[i];
            
            if(ignore.id !== stock.id){
                continue;
            }
            
            if(isAfter(new Date(), new Date(ignore.end))){
                delete ignoreList[i];
                await cache.set('ignoreList', ignoreList);
                
                console.log(`Ignorelist have run out, we're good`);
                
                break;
            }
            
            console.log(chalk.yellow(`${stock.name} is on the ignoreList, skipping`));
            
            continue stockLoop;
        }
        
        return stock;
    }
    
    return false;
};
