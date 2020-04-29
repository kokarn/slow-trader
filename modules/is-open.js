const isWeekend = require('date-fns/isWeekend');
const set = require('date-fns/set');
const isBefore = require('date-fns/isBefore');
const isAfter = require('date-fns/isAfter');
const swedishHoliday = require('swedish-holidays');

module.exports = () => {
    const now = new Date();
    const open = set(new Date(), {
        hours: 7,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
    });
    const close = set(new Date(), {
        hours: 15,
        minutes: 30,
        seconds: 0,
        milliseconds: 0,
    });
    
    if(swedishHoliday.isHoliday()){
        console.log(`Today is a swedish holiday, it's not open`);
        
        return false;
    }
    
    if(isWeekend(now)){
        console.log(`It's weekend, it's not open`);
        
        return false;
    }
    
    if(isBefore(now, open)){
        console.log(`It's before opening, it's not open`);
        
        return false;
    }
    
    if(isAfter(now, close)){
        console.log(`It's after closing, it's not open`);
        
        return false;
    }
    
    return true;
}
