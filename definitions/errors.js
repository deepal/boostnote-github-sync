class BaseError extends Error {
    constructor(...args) {
        super(...args);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

exports.FileSystemError = class FileSystemError extends BaseError {
    constructor(...args) {
        super(...args);
        this.code = 'FILE_SYSTEM_ERROR';
        this.name = 'FileSystemError';
    }
};

exports.ValidationError = class ValidationError extends BaseError {
    constructor(...args) {
        super(...args);
        this.code = 'VALIDATION_ERROR';
        this.name = 'ValidationError';
    }
};

exports.QueueError = class QueueError extends BaseError {
    constructor(...args) {
        super(...args);
        this.code = 'QUEUE_ERROR';
        this.name = 'QueueError';
    }
};
