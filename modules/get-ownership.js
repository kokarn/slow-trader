module.exports = async function seller(avanza, accountId, instrumentId){
    let positions;
    try {
        positions = await avanza.getPositions();
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
