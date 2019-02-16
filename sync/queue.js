// Keep queue immutable.

module.exports = class SyncQueue {
    /**
     * Construct a SyncQueue object
     */
    constructor() {
        this.queue = [];
        this.enqueue = this.enqueue.bind(this);
        this.dequeue = this.dequeue.bind(this);
        this.length = this.length.bind(this);
    }

    /**
     * Enqueue item
     * @param {*} item
     * @returns {void}
     */
    enqueue(item) {
        this.queue = [...this.queue, item];
    }

    /**
     * Dequeue item
     * @returns {*}
     */
    dequeue() {
        const [item, ...remainingItems] = this.queue;
        this.queue = [...remainingItems];
        return item;
    }

    /**
     * Get the length of the Sync queue
     * @returns {number}
     */
    length() {
        return this.queue.length;
    }
};
