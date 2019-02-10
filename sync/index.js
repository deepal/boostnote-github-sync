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

    async updateMetadata(remoteFile, title) {
        const metadata = await this.github.fetchOrCreateSyncMetadata();
        const fileMetaRecord = metadata.notes.find(note => note.fileName === remoteFile);
        if (!fileMetaRecord) {
            metadata.lastModified = new Date().toISOString();
            metadata.notes = [
                ...metadata.notes,
                {
                    fileName: remoteFile,
                    title
                }
            ];
        }
        const encodedMetadata = Buffer.from(JSON.stringify(metadata), 'utf-8').toString('base64');
        return this.github.updateSyncMetadata({ content: encodedMetadata, encoding: 'base64' });
    }

    async publishParsedMarkdown(syncEvent) {
        const { type, raw, file } = syncEvent;

        // Only parse Markdown Notes for now
        if (type === 'MARKDOWN_NOTE') {
            const destinationFile = `${basename(file).replace(extname(file), '')}.md`;
            const parsedContent = Buffer.from(raw.content, 'utf8').toString('base64');

            // Update metadatafile
            await this.updateMetadata(destinationFile, raw.title);
            await this.github.publishContent({
                content: parsedContent,
                encoding: 'base64',
                remotePath: destinationFile
            });
            this.logger.info(`Content of ${file} synced as a parsed markdown note`);
        }
    }

    async sync() {
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
    }
};
