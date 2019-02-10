const { basename, extname } = require('path');
const SyncQueue = require('./queue');

module.exports = class Sync {
    constructor(container, logger, config) {
        this.container = container;
        this.logger = logger;
        this.config = config;
        this.sync = this.sync.bind(this);
        this.queue = new SyncQueue();

        this.preprocessor = this.container.module('preprocessor');
        this.github = this.container.module('github');

        this.enqueueSyncItem = this.enqueueSyncItem.bind(this);
        this.sync = this.sync.bind(this);
    }

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

    async publishRaw(syncEvent) {   // eslint-disable-line
        // todo: publish raw files
    }

    async publishParsedMarkdown(syncEvent) {
        const { type, raw, file } = syncEvent;

        // Only parse Markdown Notes for now
        if (type === 'MARKDOWN_NOTE') {
            const destinationFile = `${basename(file).replace(extname(file), '')}.md`;
            const markdownContent = raw.content;

            await this.github.publishNote({
                content: markdownContent,
                remotePath: destinationFile,
                title: raw.title
            });
            this.logger.info(`Content of ${file} synced as a parsed markdown note`);
        }
    }

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
