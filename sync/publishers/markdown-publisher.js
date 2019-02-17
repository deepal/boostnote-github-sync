module.exports = class MarkdownPublisher {
    /**
     * Construct a MarkdownPublisher object
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
     * Publish Markdown Note to Github
     * @param {Object} options
     * @param {Object} options.file
     * @param {Object} options.raw
     * @returns {Promise<Object>}
     */
    async publish({ file, title, content }) {
        return this.github.publishNote({ file, title, content });
    }
};
