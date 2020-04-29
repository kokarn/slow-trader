const Avanza = require('avanza');
const uuid = require('uuid');

const streams = {};
const handlers = {};

const create = function create(avanza, instrumentId){    
    avanza.subscribe(Avanza.QUOTES, instrumentId, (quoteUpdate) => {
        for(const handlerIndex in handlers[instrumentId]){
            handlers[instrumentId][handlerIndex](quoteUpdate);
        }    
    });
    
    return true;
};

module.exports = {
    add(avanza, instrumentId, callback) {
        const id = uuid.v4();
        
        if(!handlers[instrumentId]){
            handlers[instrumentId] = {};
        }
        
        handlers[instrumentId][id] = callback;
        
        if(!streams[instrumentId]){
            streams[instrumentId] = create(avanza, instrumentId);
        }
        
        return id;
    },
    remove(instrumentId, id) {
        Reflect.deleteProperty(handlers[instrumentId], id);
        
        return true;
    },
    clear(){
        for(const instrumentId of handlers){
            Reflect.deleteProperty(handlers, instrumentId);
        }
        
        for(const instrumentId of streams){
            Reflect.deleteProperty(streams, instrumentId);
        }
        
        return true;
    },
};
