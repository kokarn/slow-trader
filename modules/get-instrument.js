const chalk = require('chalk');

module.exports = async function getInstrumentCount(avanza, id){
    let positions;
    try {
        positions = await avanza.getPositions();
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
