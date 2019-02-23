const constants = require('./constants');
const errors = require('./errors');

module.exports = class definitions {
    constructor() {
        this.constants = constants;
        this.errors = errors;
    }
};
