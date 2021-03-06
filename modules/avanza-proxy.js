const Avanza = require('avanza');
const isBefore = require('date-fns/isBefore');
const add = require('date-fns/add');

const getCourtage = require('./get-courtage');

const avanza = new Avanza();

const cache = {};

const MIN_OWNERS = 2500;

const updateCache = function updateCache(cacheKey, property, newValue){
    if(!cache[cacheKey].data){
        return false;
    }
    
    if(!cache[cacheKey].data[property]){
        return false;
    }
    
    cache[cacheKey].data[property] = newValue;
    
    return true;
};

const getMethodData = async function getMethodData(method, ...someArgs){
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
    
    return responseData;
}

const getData = async function getData(method, ...someArgs) {
    let cacheKey = method;
    if(someArgs){
        cacheKey = `${method}-${JSON.stringify(someArgs)}`;
    }
    
    if(cache[cacheKey]){
        if(isBefore(new Date(), cache[cacheKey].expires)){
            return cache[cacheKey].data;
        }
        
        Reflect.deleteProperty(cache, cacheKey);
    }
    
    responseData = await getMethodData(method, ...someArgs);
    
    cache[cacheKey] = {
        data: responseData,
        expires: add(new Date(), {
            seconds: 30,
        }),
    };
    
    return responseData;
};

const getAccountOverview = async function getAccountOverview(accountId) {
    return getData('getAccountOverview', accountId);
};

const getInstrument = async function getInstrument(instrumentType, instrumentId) {
    return getData('getInstrument', instrumentType, instrumentId);
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
    
    getPositions: async (options) => {
        if(options?.skipCache){
            return getMethodData('getPositions');
        }
        return getData('getPositions');
    },    
    getOverview: async () => {
        return getData('getOverview');
    },    
    getAccountOverview: getAccountOverview,
    getInspirationList: async (inspoId) => {
        return getData('getInspirationList', inspoId);
    },
    getInstrument: getInstrument,
    placeOrder: async (order) => {
        if(!order.volume || order.volume <= 0){
            console.log(`Order with 0 volume is invalid, let's not do that`);
            
            return false;
        }
        
        if(order.orderType === Avanza.BUY){
            const orderCost = order.volume * order.price;
            const accountOverviewCacheKey = `getAccountOverview-["${order.accountId}"]`;
            
            if(!order.sellThreshold){
                console.log(`Buy order without a sell threshold isn't allowed, not doing that`);
                
                return false;
            }
            
            const accountOverview = await getAccountOverview(order.accountId);
            const courtage = getCourtage(accountOverview.courtageClass);
            
            if(!courtage){
                console.error(`Unknown courtage class ${accountOverview.courtageClass}, can't post buy order`);
                
                return false;
            }
            
            // Courtage is a percent fee on both buy and sell orders
            const courtageCost = Math.max(courtage.mininumCost * 2, ((orderCost / 100) * courtage.feePercent) * 2);
            const possibleProfit = (orderCost / 100) * order.sellThreshold;
            
            if(courtageCost > possibleProfit){
                console.error(`Posting an order with a courtage cost of ${courtageCost} SEK and a possible profit of ${possibleProfit} SEK seems unwise, not doing that`);
                
                return false;
            }
            
            const instrumentData = await getInstrument(Avanza.STOCK, order.orderbookId);
            
            if(instrumentData.numberOfOwners < MIN_OWNERS){
                console.log(`Not buying ${order.orderbookId} as total order owners ${instrumentData.numberOfOwners} < ${MIN_OWNERS}`);
                
                return false;
            }
            
            // This should be last to prevent race conditions
            if(cache[accountOverviewCacheKey]?.data.buyingPower < order.volume * order.price){
                console.error(`Can't buy ${order.volume} of ${order.orderbookId} for ${order.price} as buyingPower is only ${cache[accountOverviewCacheKey].data.buyingPower}`);
                
                return false;
            }
            
            updateCache(accountOverviewCacheKey, 'buyingPower', cache[accountOverviewCacheKey]?.data.buyingPower - order.volume * order.price);
        }
        
        console.log(order);
        
        try {
            const orderResponse = await avanza.placeOrder(order);
            
            return orderResponse;
        } catch (orderError){
            throw orderError;
        }
    },
    subscribe: (channel, filter, callback) => {
        console.log(`Subscribing to ${channel} with ${filter}`);
        avanza.subscribe(channel, filter, callback);
    },
};
