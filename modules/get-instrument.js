const chalk = require('chalk');

const avanzaProxy = require('./avanza-proxy');

module.exports = async function getInstrumentCount(id){
    let positions;
    try {
        positions = await avanzaProxy.getPositions();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const position of positions.instrumentPositions[0].positions){
        // console.log(position);
        if(position.orderbookId !== id){
            continue;
        }
        
        return position;
    }
    
    return 0;
};
