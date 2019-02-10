/**
 * Github Helper for Boostnote Github Sync.
 * This helper currently supports creating/updating files only. Deleting files is not yet supported.
 */

const requestFn = require('request');
const fs = require('fs');
const { resolve } = require('url');
const { join, basename } = require('path');
const { promisify } = require('util');
const httpStatus = require('./httpStatus');
const { trimSlashes } = require('./helpers');

module.exports = class GithubHelper {
    /**
     * Create a Github Helper object
     * @param {*} container
     * @param {*} logger
     * @param {*} config
     */
    constructor(container, logger, config) {
        this.container = container;
        this.logger = logger;
        this.config = config;

        this.repo = this.config.repository;
        this.apiConfig = this.config.api;
        this.commitConfig = this.config.commit;

        this.defaultRefs = `heads/${this.repo.branch}`;

        this.sendRequest = this.createClient();
    }

    /**
     * Create a github client
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
     */
    getUser() {
        return this.userId;
    }

    /**
     * Get github user id
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
     */
    async getHead() {
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repo.name}/git/refs/${this.defaultRefs}` // default notes branch is 'master'
        });

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error('Failed to fetch head');
        }

        const { object } = body;
        return object.sha;
    }

    /**
     * Grab the tree information from the commit that HEAD points to
     * @param {string} hash
     */
    async getCommitTreeSHA(hash) {
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repo.name}/git/commits/${hash}`
        });

        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error('Failed to fetch commit stats');
        }

        const { message, tree } = body;
        this.logger.debug(`fetched HEAD at : ${message} (${hash})`);
        return tree.sha;
    }

    /**
     * Post the content-to-by-synced as a git blob
     * @param {string} localFile
     */
    async publishBlobFromContent({ content, encoding }) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/blobs`,
            body: { content, encoding }
        });
        if (status !== httpStatus.CREATED) {
            this.logger.error(body);
            throw new Error('Failed to publish blob from content');
        }

        const { sha } = body;
        return sha;
    }

    /**
     * Create a tree containing new file
     * @param {object} options
     * @param {string} options.baseTreeSHA
     * @param {string} options.remoteFilePath
     * @param {string} options.blobSHA
     */
    async updateTree({ baseTreeSHA, remoteFilePath, blobSHA }) {
        const GITHUB_BLOB_MODE = '100644';
        const GITHUB_BLOB_TYPE = 'blob';

        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/trees`,
            body: {
                base_tree: baseTreeSHA,
                tree: [
                    {
                        path: trimSlashes(remoteFilePath), // remove leading and trailing slashes if any
                        mode: GITHUB_BLOB_MODE,
                        type: GITHUB_BLOB_TYPE,
                        sha: blobSHA
                    }
                ]
            }
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
     */
    async commit({ parentCommitSHA, treeSHA, message }) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/commits`,
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
     */
    async updateHead(commitSHA) {
        const { status, body } = await this.sendRequest({
            method: 'patch',
            path: `/repos/${this.userId}/${this.repo.name}/git/refs/${this.defaultRefs}`,
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
     * Convenience function to sync file to github
     * @param {object} options
     * @param {string} options.filePath
     * @param {string} options.remotePath
     */
    async publishFile({ filePath, remotePath }) {
        const encoding = 'base64';
        const content = (await promisify(fs.readFile)(filePath)).toString(encoding);
        return this.publishContent({ content, encoding, remotePath: (remotePath || basename(filePath)) });
    }

    /**
     * Convenience function to sync content to github
     * @param {object} options
     * @param {object} options.content
     * @param {object} options.encoding
     * @param {object} options.remotePath
     */
    async publishContent({ content, encoding, remotePath }) {
        const destinationFile = join(this.repo.baseDir, remotePath);
        await this.fetchGithubUser();
        const headHash = await this.getHead();
        const treeHash = await this.getCommitTreeSHA(headHash);
        const blobHash = await this.publishBlobFromContent({ content, encoding });
        const updatedTree = await this.updateTree({
            baseTreeSHA: treeHash,
            remoteFilePath: destinationFile,
            blobSHA: blobHash
        });
        this.logger.debug(`Published blob. Updated tree hash: ${updatedTree}`);
        const commitHash = await this.commit({
            message: `Sync content to remote file ${remotePath}`,
            parentCommitSHA: headHash,
            treeSHA: updatedTree
        });
        this.logger.debug(`Commit ${commitHash} created!`);
        await this.updateHead(commitHash);
    }
};
