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
    
    let orderbook;
    try {
        orderbook = await avanza.getDealsAndOrders();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const order of orderbook.orders){
        if(order.account.id !== process.env.AVANZA_ISK_ID){
            continue;
        }
        
        console.log(JSON.stringify(order, null, 4));
    }
    
    avanza.disconnect();
})();
