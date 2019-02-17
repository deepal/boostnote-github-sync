module.exports = class RawPublisher {
    /**
     * Construct a RawPublisher object
     * @param {Map} container
     * @param {Logger} logger
     * @param {Object} config
     */
    constructor(container, logger, config) {
        this.container = container;
        this.logger = logger;
        this.config = config;
        this.github = this.container.module('github');
    }

    /**
     * Publish Raw file to Github
     * @param {Object} options
     * @param {Object} options.file
     * @param {Object} options.raw
     * @returns {Promise<Object>}
     */
    async publish({ file, raw }) {
        return Promise.resolve();
    }
}
