exports.RepositoryEmptyError = class RepositoryEmptyError extends Error {
    constructor(...args) {
        super(...args);
        this.code = 'ERR_REPOSITORY_EMPTY';
        this.name = 'RepositoryEmptyError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
};

exports.AuthorizationError = class AuthorizationError extends Error {
    constructor(...args) {
        super(...args);
        this.code = 'ERR_AUTHORIZATION';
        this.name = 'AuthorizationError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
};

exports.ConnectionError = class ConnectionError extends Error {
    constructor(...args) {
        super(...args);
        this.code = 'ERR_CONNECTION';
        this.name = 'ConnectionError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
};

exports.RemoteFileNotFoundError = class RemoteFileNotFoundError extends Error {
    constructor(...args) {
        super(...args);
        this.code = 'ERR_REMOTE_FILE_NOT_FOUND';
        this.name = 'RemoteFileNotFoundError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
};

exports.GitHubInternalError = class GitHubError extends Error {
    constructor(...args) {
        super(...args);
        this.code = 'ERR_GITHUB_INTERNAL';
        this.name = 'GitHubInternalError';
        this.stack = `${this.message}\n${new Error().stack}`;
    }
};
