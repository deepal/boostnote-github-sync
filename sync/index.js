const SyncQueue = require('./queue');
const SnippetPublisher = require('./publishers/snippet-publisher');
const MarkdownPublisher = require('./publishers/markdown-publisher');

const NOTE_TYPES = {
    MARKDOWN_NOTE: 'MARKDOWN_NOTE',
    SNIPPET_NOTE: 'SNIPPET_NOTE'
};

module.exports = class Sync {
    /**
     * Construct Sync Module
     * @param {Map} container
     * @param {Logger} logger
     * @param {Object} config
     */
    constructor(container, logger, config) {
        this.container = container;
        this.logger = logger;
        this.config = config;
        this.sync = this.sync.bind(this);
        this.queue = new SyncQueue();
        this.snippetPublisher = new SnippetPublisher(container, logger, config);
        this.markdownPublisher = new MarkdownPublisher(container, logger, config);

        this.preprocessor = this.container.module('preprocessor');
        this.github = this.container.module('github');

        this.enqueueSyncItem = this.enqueueSyncItem.bind(this);
        this.sync = this.sync.bind(this);
    }

    /**
     * Enqueue item to be synced
     * @param {object} event
     * @param {string} file
     * @returns {void}
     */
    enqueueSyncItem(event, file) {
        this.preprocessor
            .processChangeSet(event, file)
            .then((syncEvent) => {
                this.logger.info(`[event=${syncEvent.event} file=${syncEvent.file} type=${syncEvent.type}]`);
                this.queue.enqueue(syncEvent);
                this.logger.info(`[Queue] ${this.queue.length()} items in sync queue!`);
                return this.sync();
            })
            .then(() => {
                this.logger.info('Sync queue is emptied');
            });
    }

    async publishRaw() {
        this.logger.info('Publishing raw files is not yet supported. Skipping...');
    }

    /**
     * Publish Parsed Markdown from raw file content
     * @param {Object} options
     * @param {string} options.file
     * @param {string} options.raw
     * @param {string} options.type
     * @returns {Promise<void>}
     */
    async publishParsedMarkdown({ file, raw, type }) {
        if (type === NOTE_TYPES.MARKDOWN_NOTE) {
            await this.markdownPublisher.publish({ file, raw });
            this.logger.info(`Content of ${file} synced as a parsed markdown note`);
        }

        if (type === NOTE_TYPES.SNIPPET_NOTE) {
            await this.snippetPublisher.publish({ file, raw });
            this.logger.info(`Content of ${file} synced as a parsed snippet note`);
        }
    }

    /**
     * Run Sync Process
     * @returns {void}
     */
    async sync() {
        try {
            if (this.config.enabled) {
                while (this.queue.length()) {
                    const item = this.queue.dequeue();

                    if (this.config.modes.raw) {
                        await this.publishRaw(item); // eslint-disable-line no-await-in-loop
                    }

                    if (this.config.modes.parsed) {
                        await this.publishParsedMarkdown(item); // eslint-disable-line no-await-in-loop
                    }
                }
            } else {
                this.logger.info('Sync is disabled by configuration');
            }
        } catch (err) {
            this.logger.error('Error occurred during sync process', err);
        }
    }
};
