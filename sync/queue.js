// Keep queue immutable.

module.exports = class SyncQueue {
    constructor() {
        this.queue = [];
        this.log = [];
        this.enqueue = this.enqueue.bind(this);
        this.dequeue = this.dequeue.bind(this);
        this.getLog = this.getLog.bind(this);
        this.length = this.length.bind(this);
        this.addLog = this.addLog.bind(this);
        this.clearLogs = this.clearLogs.bind(this);
    }

    enqueue(item) {
        this.queue = [...this.queue, item];
    }

    dequeue() {
        const [item, ...remainingItems] = this.queue;
        this.queue = [...remainingItems];
        return item;
    }

    getLog() {
        return this.log;
    }

    length() {
        return this.queue.length;
    }

    addLog(action) {
        this.history = [...this.history, action];
    }

    clearLogs() {
        this.history = [];
    }
};
