const Avanza = require('avanza');
const isBefore = require('date-fns/isBefore');
const add = require('date-fns/add');

const getCourtage = require('./get-courtage');

const avanza = new Avanza();

const cache = {};

const updateCache = function updateCache(method, property, newValue){
    if(!cache[method]){
        return false;
    }
    
    if(!cache[method][property]){
        return false;
    }
    
    cache[method][property] = newValue;
    
    return true;
};

const getMethodData = async function getMethodData(method, ...someArgs) {
    if(cache[method]){
        if(isBefore(new Date(), cache[method].expires)){
            return cache[method].data;
        }
        
        Reflect.deleteProperty(cache, method);
    }
    
    let responseData;
    try {
        if(someArgs){
            responseData = await avanza[method](...someArgs);
        } else {
            responseData = await avanza[method]();
        }
    } catch (requestError){
        console.error(requestError);
        
        return false;
    }
    
    cache[method] = {
        data: responseData,
        expires: add(new Date(), {
            seconds: 30,
        }),
    };
    
    return responseData;
};

const getAccountOverview = async function getAccountOverview(accountId) {
    return getMethodData('getAccountOverview', accountId);
};

module.exports = {
    connect: async () => {
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
    },
    disconnect: () => {
        avanza.disconnect();
    },
    
    getPositions: async () => {
        return getMethodData('getPositions');
    },    
    getOverview: async () => {
        return getMethodData('getOverview');
    },    
    getAccountOverview: getAccountOverview,
    getInspirationList: async (inspoId) => {
        return getMethodData('getInspirationList', inspoId);
    },
    placeOrder: async (order) => {
        if(!order.volume || order.volume <= 0){
            console.log(`Order with 0 volume is invalid, let's not do that`);
            
            return false;
        }
        
        if(order.orderType === Avanza.BUY){
            const orderCost = order.volume * order.price;
            
            if(!order.sellThreshold){
                console.log(`Buy order without a sell threshold isn't allowed, not doing that`);
                
                return false;
            }
            
            const accountOverview = await getAccountOverview(order.accountId);
            const courtage = getCourtage(accountOverview.courtageClass);
            
            if(!courtage){
                console.error(`Unknown courtage class ${accountOverview.courtageClass}, can't buy post order`);
                
                return false;
            }
            
            // Courtage is a percent fee on both buy and sell orders
            const courtageCost = Math.max(courtage.mininumCost * 2, ((orderCost / 100) * courtage.feePercent) * 2);
            const possibleProfit = (orderCost / 100) * order.sellThreshold;
            
            if(courtageCost > possibleProfit){
                console.error(`Posting an order with a courtage cost of ${courtageCost} SEK and a possible profit of ${possibleProfit} SEK seems unwise, not doing that`);
                
                return false;
            }
            
            if(cache['getPositions'] && cache['getPositions'].totalBuyingPower < order.volume * order.price){
                console.error(`Can't buy ${order.volume} of ${order.orderbookId} for ${order.price} as buyingPower is only ${cache['getPositions'].totalBuyingPower}`);
                
                return false;
            }
            
            updateCache('getPositions', 'totalBuyingPower', cache['getPositions']?.totalBuyingPower - order.volume * order.price);
        }
        
        try {
            const orderResponse = await avanza.placeOrder(order);
            
            return orderResponse;
        } catch (orderResponse){
            throw orderError;
        }
    },
    subscribe: (channel, filter, callback) => {
        avanza.subscribe(channel, filter, callback);
    },
};
