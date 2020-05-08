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
        }, 290000);
    }
    
    stop(){
        clearInterval(this.buyInterval);
        
        return true;
    }
}

module.exports = TimerIndicator;
