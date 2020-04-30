const EventEmitter = require('events');

class TimerIndicator extends EventEmitter {
    buyInterval = false;
    
    constructor(){
        super();
        
        this.setup();
    }
    
    setup() {
        // Emit 
        this.buyInterval = setInterval(() => {
            this.emit('buy');
        }, 590000);
    }
}

module.exports = TimerIndicator;
