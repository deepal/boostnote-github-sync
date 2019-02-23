exports.PreProcessError = class PreProcessError extends Error {
    constructor(...args) {
        super(...args);
        this.code = 'ERR_PREPROCESS';
        this.name = 'PreProcessError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
};
