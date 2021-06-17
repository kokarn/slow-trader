const LEVELS = {
    // START: {
    //     mininumCost: 0,
    //     feePercent: 0,
    // },
    START: {
        mininumCost: 1,
        feePercent: 0.25,
    },
    MINI: {
        mininumCost: 1,
        feePercent: 0.25,
    },
    SMALL: {
        mininumCost: 39,
        feePercent: 0.15,
    },
    MEDIUM: {
        mininumCost: 69,
        feePercent: 0.069,
    },
    FAST: {
        mininumCost: 99,
        feePercent: 0,
    },
};

module.exports = (level) => {
    return LEVELS[level];
};
