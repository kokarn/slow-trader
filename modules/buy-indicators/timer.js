const EventEmitter = require('events');

class TimerIndicator extends EventEmitter {
    buyInterval = false;
    
    constructor(){
        super();
        
        this.setup();
    }
    
    setup() {
        console.log('Setting up "timer" buy indicator');
        this.buyInterval = setInterval(() => {
            this.emit('buy');
        }, 590000);
    }
}

module.exports = TimerIndicator;
