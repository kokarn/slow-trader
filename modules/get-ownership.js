const avanzaProxy = require('./avanza-proxy');

module.exports = async function seller(accountId, instrumentId){
    let positions;
    try {
        positions = await avanzaProxy.getPositions({
            skipCache: true,
        });
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const position of positions.instrumentPositions[0].positions){
        if(position.accountId !== accountId){
            continue;
        }
        
        if(position.orderbookId !== instrumentId){
            continue;
        }
        
        return position;
    }
    
    return false;
};
