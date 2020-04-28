require('dotenv').config();

const Avanza = require('avanza');
const cache = require('./modules/cache');

const avanza = new Avanza();

const ORDERBOOK_ID = '460955';

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

    console.log(`Setting up stream for ${ORDERBOOK_ID}`);
    avanza.subscribe(Avanza.QUOTES, ORDERBOOK_ID, (quoteUpdate) => {
        console.log('Got something');
        console.log(quoteUpdate);
    })
})();

process.on('SIGINT', () => {
    avanza.disconnect();
    process.exit();
});
