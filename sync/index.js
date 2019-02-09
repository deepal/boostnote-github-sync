const SyncQueue = require('./queue');

module.exports = class Sync { 
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.sync = this.sync.bind(this);
        this.queue = new SyncQueue();

        this.preprocessor = this.container.module('preprocessor');

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
            });
    }

    sync() {
        while(this.queue.length) {
            const item = this.queue.dequeue();
            // sync 'item'
        }
    }
}