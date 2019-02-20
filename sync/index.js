const SyncQueue = require('./queue');
const { isNoteEmpty, sanitizeNote } = require('./utils');
const Lock = require('./lock');
const SnippetPublisher = require('./publishers/snippet-publisher');
const MarkdownPublisher = require('./publishers/markdown-publisher');

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
        this.queue = new SyncQueue();
        this.snippetPublisher = new SnippetPublisher(container, logger, config);
        this.markdownPublisher = new MarkdownPublisher(container, logger, config);
        this.lock = new Lock();
        this.preprocessor = this.container.module('preprocessor');
        this.constants = this.container.module('constants');
        this.github = this.container.module('github');
    }

    /**
     * Trigger sync process
     * @returns {Promise}
     */
    triggerSync() {
        if (this.config.enabled) {
            if (this.queue.length() > 0 && this.lock.aquire()) {
                this.syncItem()
                    .then(() => {
                        /* Wait for some time until the next item is synced. This is to prevent exceeding github API rate limit
                         * See also: https://developer.github.com/v3/#rate-limiting
                        */
                        setTimeout(() => {
                            this.logger.debug('Releasing Sync lock...');
                            this.lock.release();
                            this.triggerSync();
                        }, this.config.delay);
                    });
            }
        } else {
            this.logger.warn('Sync process is disable by configuration');
        }
    }

    /**
     * Enqueue item to be synced
     * @param {object} event
     * @param {string} file
     * @returns {void}
     */
    enqueueSyncItem(event, file) {
        // TODO: Move preprocessing to watcher. Sync module has nothing to do with it.
        this.preprocessor
            .processChangeSet(event, file)
            .then((syncEvent) => {
                this.logger.debug(`[event=${syncEvent.event} file=${syncEvent.file} type=${syncEvent.type || '<n/a>'}]`);
                this.queue.enqueue(syncEvent);
                this.logger.info(`[Queue] ${this.queue.length()} items in sync queue!`);
                this.triggerSync();
            });
    }

    /**
     * Sync raw files to github
     * @returns {void}
     */
    async syncRaw() {
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
    async syncParsedMarkdown({ file, raw, type, checksum }) {
        const { title, content } = raw;
        if (type === this.constants.fileTypes.MARKDOWN_NOTE) {
            await this.markdownPublisher.publish({ file, title, content, checksum });
            this.logger.info(`Content of ${file} synced as a parsed markdown note`);
        }

        if (type === this.constants.fileTypes.SNIPPET_NOTE) {
            await this.snippetPublisher.publish({ file, title, content, checksum });
            this.logger.info(`Content of ${file} synced as a parsed snippet note`);
        }
    }

    /**
     * Sync an item from the queue
     * @returns {void}
     */
    async syncItem() {
        try {
            if (!this.config.enabled) {
                this.logger.info('Sync is disabled by configuration');
                return;
            }

            // TODO: Should fix the no-await-in-loop lint issue by using Promise.all()
            if (this.queue.length()) {
                const queueItem = this.queue.dequeue();
                const { event, file, raw, type, checksum } = queueItem;

                try {
                    if (event === this.constants.events.FILE_CREATE_OR_UPDATE) {
                        const isParsableContent = [
                            this.constants.fileTypes.MARKDOWN_NOTE,
                            this.constants.fileTypes.SNIPPET_NOTE
                        ].includes(type);

                        if (this.config.modes.raw) {
                            await this.syncRaw({ file, raw, checksum }); // eslint-disable-line no-await-in-loop
                        }

                        if (this.config.modes.parsed && isParsableContent) {
                            if (isNoteEmpty(raw)) {
                                this.logger.info(`File ${file} is an empty note. Skipping...`);
                            } else {
                                await this.syncParsedMarkdown({ // eslint-disable-line no-await-in-loop
                                    file,
                                    type,
                                    raw: sanitizeNote(raw),
                                    checksum
                                });
                            }
                        }
                    } else if (event === this.constants.events.FILE_DELETE) {
                        await this.github.deleteNote(file); // eslint-disable-line no-await-in-loop
                        this.logger.info(`File ${file} synced as a deleted note`);
                    } else {
                        this.logger.info(`Unknown sync event: ${event}. Skipping...`);
                    }
                } catch (err) {
                    this.logger.warn(`An error occurred while syncing ${file}. Adding it back to the sync queue`);
                    this.queue.enqueue(queueItem);
                }
            }
        } catch (err) {
            this.logger.error('Error occurred during sync', err);
        }
    }
};
