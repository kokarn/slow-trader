const Avanza = require('avanza');
const uuid = require('uuid');

const streams = {};
const handlers = {};
const paused = {};

const create = function create(avanza, instrumentId){    
    avanza.subscribe(Avanza.QUOTES, instrumentId, (quoteUpdate) => {
        for(const handlerId in handlers[instrumentId]){
            if(paused[instrumentId]?.[handlerId]){
                continue;
            }
            
            handlers[instrumentId][handlerId](quoteUpdate);
        }    
    });
    
    return true;
};

module.exports = {
    add(avanza, instrumentId, callback) {
        const handlerId = uuid.v4();
        
        if(!handlers[instrumentId]){
            handlers[instrumentId] = {};
        }
        
        handlers[instrumentId][handlerId] = callback;
        
        if(!streams[instrumentId]){
            streams[instrumentId] = create(avanza, instrumentId);
        }
        
        return handlerId;
    },
    remove(instrumentId, handlerId) {
        Reflect.deleteProperty(handlers[instrumentId], handlerId);
        
        return true;
    },
    clear(){
        for(const instrumentId in handlers){
            Reflect.deleteProperty(handlers, instrumentId);
        }
        
        for(const instrumentId in streams){
            Reflect.deleteProperty(streams, instrumentId);
        }
        
        return true;
    },
    pause(instrumentId, handlerId){
        if(!paused[instrumentId]){
            paused[instrumentId] = {};
        }
        
        paused[instrumentId][handlerId] = true;
    },
    unpause(instrumentId, handlerId){
        Reflect.deleteProperty(paused[instrumentId], handlerId);
        
        return true;
    },
};
