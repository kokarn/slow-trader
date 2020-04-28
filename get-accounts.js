require('dotenv').config();

const Avanza = require('avanza');
const chalk = require('chalk');

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
    
    let accountOverview;
    try {
        accountOverview = await avanza.getOverview();
    } catch (overviewError){
        console.error(overviewError);
        
        return false;
    }
    
    for(const account of accountOverview.accounts){
        console.log(JSON.stringify({
            id: account.accountId,
            name: account.name,
        }, null, 4));
    }
    
    avanza.disconnect();
})();
