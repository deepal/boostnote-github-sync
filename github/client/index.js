/**
 * Github Client for Boostnote Github Sync.
 * This helper currently supports creating/updating files only. Deleting files is not yet supported.
 */

const requestFn = require('request');
const { resolve } = require('url');
const { promisify } = require('util');
const httpStatus = require('../httpStatus');
const errorCode = require('./errors');
const {
    trimSlashes,
    decodeToUtf8
} = require('../helpers');

const GITHUB_BLOB_MODE = '100644';
const GITHUB_BLOB_TYPE = 'blob';
const ERR_FILE_NOT_FOUND = 'ENOENT';

exports.constants = { GITHUB_BLOB_MODE, GITHUB_BLOB_TYPE, ERR_FILE_NOT_FOUND };
exports.errorCode = errorCode;

exports.Client = class GithubClient {
    /**
     * Create a Github Helper object
     * @param {*} container
     * @param {*} logger
     * @param {*} config
     */
    constructor({ container, logger, config }) {
        const { repoConfig, apiConfig, commitConfig } = config;
        this.container = container;
        this.logger = logger;

        this.repoConfig = repoConfig;
        this.apiConfig = apiConfig;
        this.commitConfig = commitConfig;

        this.defaultRefs = `heads/${this.repoConfig.branch}`;
        this.sendRequest = this.createClient();
    }

    /**
     * Create a github client
     * @returns {Function}
     */
    createClient() {
        const request = promisify(requestFn);
        return async ({ method, path, body }) => {
            const response = await request({
                method,
                url: `${resolve(this.apiConfig.url, path)}`,
                headers: {
                    Authorization: `Bearer ${this.apiConfig.accessToken}`,
                    'User-Agent': '',
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body,
                json: true
            });

            return {
                status: response.statusCode,
                body: response.body
            };
        };
    }

    /**
     * Return github user id
     * @returns {string}
     */
    getUser() {
        return this.userId;
    }

    /**
     * Get github user id
     * @returns {void}
     */
    async fetchGithubUser() {
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: '/user'
        });

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error('Failed to fetch user details');
        }

        const { login } = body;
        this.userId = login;
    }

    /**
     * Get a reference to the HEAD of sync repository
     * @param {string} branch
     * @returns {Promise<string>}
     */
    async getHead(branch) {
        const refs = branch ? `heads/${branch}` : this.defaultRefs;
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/refs/${refs}` // default notes branch is 'master'
        });

        if (status === httpStatus.CONFLICT) {
            const error = new Error(body.message);
            error.code = errorCode.ERR_REPOSITORY_EMPTY;
            throw error;
        }

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error('Failed to fetch head');
        }

        const { object } = body;
        return object.sha;
    }

    /**
     * Grab the tree information from the commit that HEAD points to
     * @param {string} commitHash
     * @returns {Promise<string>}
     */
    async getTreeHash(commitHash) {
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/commits/${commitHash}`
        });

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error('Failed to fetch commit stats');
        }

        const { message, tree } = body;
        this.logger.debug(`fetched HEAD at : ${message} (${commitHash})`);
        return tree.sha;
    }

    /**
     * Post the content-to-by-synced as a git blob
     * @param {object} options
     * @param {string} options.content
     * @param {string} options.encoding
     * @returns {Promise<string>}
     */
    async createBlob({ content, encoding }) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/blobs`,
            body: { content, encoding }
        });
        if (status !== httpStatus.CREATED) {
            this.logger.error(body);
            throw new Error('Failed to create blob from content');
        }

        const { sha } = body;
        return sha;
    }

    async getBlob(blobSHA) {
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/blobs/${blobSHA}`
        });
        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error(`Failed to get blob ${blobSHA}`);
        }

        const { content, encoding } = body;
        return decodeToUtf8(content, encoding);
    }

    /**
     * Get git tree
     * @param {string} treeHash
     * @param {object} opitions
     * @param {boolean} opitions.recursive
     * @returns {Promise<object>}
     */
    async getTree(treeHash, { recursive = false } = {}) {
        let requestPath = `/repos/${this.userId}/${this.repoConfig.name}/git/trees/${treeHash}`;

        if (recursive) requestPath += '?recursive=1';

        const { status, body } = await this.sendRequest({
            method: 'get',
            path: requestPath
        });

        if (status === httpStatus.NOT_FOUND) {
            // tree is empty
            return { tree: [], truncated: false };
        }

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error(`Failed to get tree ${treeHash}`);
        }
        const { tree, truncated } = body;
        return { tree, truncated };
    }

    /**
     * Create a tree containing new file
     * TODO: Currently, only one file can be added to the tree at a time. Can be improved later.
     * @param {object} options
     * @param {string} options.baseTreeSHA
     * @param {string} options.remoteFilePath
     * @param {string} options.blobSHA
     * @returns {Promise<string>}
     */
    async createTree({ baseTreeSHA, blobs = [] }) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/trees`,
            body: {
                base_tree: baseTreeSHA,
                tree: blobs.map(({ path, sha }) => ({
                    path: trimSlashes(path), // remove leading and trailing slashes if any
                    mode: GITHUB_BLOB_MODE,
                    type: GITHUB_BLOB_TYPE,
                    sha
                }))
            }
        });

        if (status !== httpStatus.CREATED) {
            this.logger.error(body);
            throw new Error('Failed to update tree');
        }
        return body.sha;
    }

    /**
     * Force rebuild git tree
     * @param {Object} tree
     * @returns {string}
     */
    async rebuildTree(tree) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/trees`,
            body: { tree }
        });

        if (status !== httpStatus.CREATED) {
            this.logger.error(body);
            throw new Error('Failed to update tree');
        }
        return body.sha;
    }

    /**
     * Create a new commit after updating tree
     * @param {object} options
     * @param {string} options.parentCommitSHA
     * @param {string} options.treeSHA
     * @param {string} options.message
     * @returns {Promise<string>}
     */
    async commit({ parentCommitSHA, treeSHA, message }) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/commits`,
            body: {
                message,
                author: {
                    name: this.commitConfig.userName,
                    email: this.commitConfig.userEmail,
                    date: (new Date()).toISOString()
                },
                parents: [parentCommitSHA],
                tree: treeSHA
            }
        });

        if (status !== httpStatus.CREATED) {
            this.logger.error(body);
            throw new Error('Failed to commit file');
        }
        return body.sha;
    }

    /**
     * Update head with new commit
     * @param {string} commitSHA
     * @returns {Promise<object>}
     */
    async updateHead(commitSHA) {
        const { status, body } = await this.sendRequest({
            method: 'patch',
            path: `/repos/${this.userId}/${this.repoConfig.name}/git/refs/${this.defaultRefs}`,
            body: {
                sha: commitSHA,
                force: false
            }
        });

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error('Failed to update head');
        }
        return body;
    }

    /**
     * Initialize empty repository with a README.md file
     * @returns {Promise<object>}
     */
    async initializeReadMe() {
        const { status, body } = await this.sendRequest({
            method: 'put',
            path: `/repos/${this.userId}/${this.repoConfig.name}/contents/README.md`,
            body: {
                message: 'Initial commit',
                committer: {
                    name: this.commitConfig.userName,
                    email: this.commitConfig.userEmail
                },
                content: ''
            }
        });

        if (status !== httpStatus.CREATED) {
            this.logger.error(body.message);
            throw new Error('Failed to initialize repository');
        }

        const { commit } = body;
        return commit.sha;
    }
};
