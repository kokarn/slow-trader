require('dotenv').config();

const Avanza = require('avanza');

const avanza = new Avanza();

( async () => {
    try {
        await avanza.authenticate({
            username: process.env.AVANZA_USERNAME,
            password: process.env.AVANZA_PASSWORD,
            totpSecret: process.env.AVANZA_TOTP_SECRET,
          });
    } catch (authenticationError){
        console.error(authenticationError);
        
        return false;
    }
    
    let positionOverview;
    try {
        positionOverview = await avanza.getPositions();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const position of positionOverview.instrumentPositions[0].positions){
        if(position.accountId !== process.env.AVANZA_ISK_ID){
            continue;
        }
        
        console.log(JSON.stringify(position, null, 4));
    }
    
    avanza.disconnect();
})();
