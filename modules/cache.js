const fs = require('fs').promises;
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'cache.json');

const data = require('../cache.json');

const save = async function save(){
    return fs.writeFile(DATA_PATH, JSON.stringify(data, null, 4));
};

module.exports = {
    get: async (key) => {
        return data[key];
    },
    set: async (key, value) => {
        data[key] = value;
        
        return await save();
    },
    add: async (key, value) => {
        data[key].push(value);
        
        return await save();
    },
};
