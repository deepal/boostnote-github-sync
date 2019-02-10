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

const GITHUB_BLOB_MODE = '100644';
const GITHUB_BLOB_TYPE = 'blob';
const ERR_FILE_NOT_FOUND = 'ENOENT';

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
    async getHead(branch) {
        const refs = branch ? `heads/${branch}` : this.defaultRefs;
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repo.name}/git/refs/${refs}` // default notes branch is 'master'
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
     * @param {string} commitHash
     */
    async getTreeHash(commitHash) {
        const { status, body } = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repo.name}/git/commits/${commitHash}`
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
     * @param {string} localFile
     */
    async createBlob({ content, encoding }) {
        const { status, body } = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/blobs`,
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
            path: `/repos/${this.userId}/${this.repo.name}/git/blobs/${blobSHA}`
        });
        if (status !== httpStatus.OK) {
            this.logger.error(body);
            throw new Error(`Failed to get blob ${blobSHA}`);
        }

        const { content, encoding } = body;
        return Buffer.from(content, encoding).toString('utf-8');
    }

    /**
     * Get git tree
     * @param {string} treeHash
     * @param {object} opitions
     * @param {boolean} opitions.recursive
     */
    async getTree(treeHash, { recursive = false } = {}) {
        let requestPath = `/repos/${this.userId}/${this.repo.name}/git/trees/${treeHash}`;

        if (recursive) requestPath += '?recursive=1';

        const { status, body } = await this.sendRequest({
            method: 'get',
            path: requestPath
        });

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
     */
    async createTree({ baseTreeSHA, remoteFilePath, blobSHA }) {
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
     * Fetch a file from the given branch
     * @param {object} options
     * @param {string} options.branch
     * @param {string} options.filePath
     */
    async fetchFile({ branch, filePath }) {
        await this.fetchGithubUser();
        const headSHA = await this.getHead(branch);
        const treeSHA = await this.getTreeHash(headSHA);
        const { tree, truncated } = await this.getTree(treeSHA);

        const blob = tree.find(({ type, path }) => type === GITHUB_BLOB_TYPE && path === trimSlashes(filePath));

        if (!blob) {
            const error = new Error(`File not found. [truncated_result=${truncated}]`);
            error.code = ERR_FILE_NOT_FOUND;
            throw error;
        }

        return this.getBlob(blob.sha);
    }

    /**
     * Convenience function to fetch boostnote-github-sync metadata file from github
     */
    async fetchOrCreateSyncMetadata() {
        try {
            const content = await this.fetchFile({
                branch: this.repo.branch,
                filePath: this.repo.metadataFile
            });
            return JSON.parse(content);
        } catch (err) {
            if (err.code === ERR_FILE_NOT_FOUND) {
                this.logger.info(`Metadata file not found on branch ${this.repo.branch}. Creating new file...`);
                const timestamp = new Date().toISOString();
                const metadataContent = {
                    created: timestamp,
                    lastModified: timestamp,
                    notes: []
                };
                const encodedContent = Buffer.from(JSON.stringify(metadataContent, null, 4), 'utf-8').toString('base64');
                await this.publishContent({
                    content: encodedContent,
                    encoding: 'base64',
                    remotePath: this.repo.metadataFile
                });
                this.logger.info(`New metadata file created at ${this.repo.metadataFile}`);
                return metadataContent;
            }

            this.logger.error('Unknown error while fetching or creating sync metadata', err);
            throw err;
        }
    }

    async updateSyncMetadata({ content, encoding }) {
        return this.publishContent({
            content,
            encoding,
            remotePath: this.repo.metadataFile
        });
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
        const treeHash = await this.getTreeHash(headHash);
        const blobHash = await this.createBlob({ content, encoding });
        const updatedTree = await this.createTree({
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
