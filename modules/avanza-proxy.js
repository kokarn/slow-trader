const Avanza = require('avanza');
const isBefore = require('date-fns/isBefore');
const add = require('date-fns/add');

const avanza = new Avanza();

const cache = {};

const updateCache = function updateCache(method, property, newValue){
    cache[method][property] = newValue;
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
    getInspirationList: async (inspoId) => {
        return getMethodData('getInspirationList', inspoId);
    },
    placeOrder: async (order) => {
        if(order.orderType === Avanza.BUY){
            if(cache['getPositions'].totalBuyingPower < order.volume * order.price){
                console.error(`Can't buy ${order.volume} of ${order.orderbookId} for ${order.price} as buyingPower is only ${cache['getPositions'].totalBuyingPower}`);
                
                return false;
            }
            
            updateCache('getPositions', 'totalBuyingPower', cache['getPositions'].totalBuyingPower - order.volume * order.price);
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
