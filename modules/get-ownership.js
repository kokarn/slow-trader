module.exports = async function seller(avanza, instrumentId){
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
        
        if(position.orderbookId !== instrumentId){
            continue;
        }
        
        return position;
    }
    
    return false;
};
