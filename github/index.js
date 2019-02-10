/**
 * Github Helper for Boostnote Github Sync.
 * This helper currently supports creating/updating files only. Deleting files is not yet supported.
 */

const fs = require('fs');
const { join, basename } = require('path');
const { promisify } = require('util');
const { trimSlashes, jsonToBase64, encodeFromUtf8 } = require('./helpers');
const { Client, constants } = require('./client');

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

        this.repoConfig = this.config.repository;
        this.apiConfig = this.config.api;
        this.commitConfig = this.config.commit;

        this.client = new Client(container, logger, {
            repoConfig: this.repoConfig,
            apiConfig: this.apiConfig,
            commitConfig: this.commitConfig
        });
    }

    /**
     * Fetch a file from the given branch
     * @param {object} options
     * @param {string} options.branch
     * @param {string} options.filePath
     * @returns {Promise<object>}
     */
    async fetchFile({ branch, filePath }) {
        await this.client.fetchGithubUser();
        const headSHA = await this.client.getHead(branch);
        const treeSHA = await this.client.getTreeHash(headSHA);
        const { tree, truncated } = await this.client.getTree(treeSHA);

        const blob = tree.find(({ type, path }) => type === constants.GITHUB_BLOB_TYPE && path === trimSlashes(filePath));

        if (!blob) {
            const error = new Error(`File not found. [truncated_result=${truncated}]`);
            error.code = constants.ERR_FILE_NOT_FOUND;
            throw error;
        }

        return this.client.getBlob(blob.sha);
    }

    /**
     * Convenience function to fetch boostnote-github-sync metadata file from github
     * @returns {Promise<object>}
     */
    async fetchOrCreateSyncMetadata() {
        try {
            const content = await this.fetchFile({
                branch: this.repoConfig.branch,
                filePath: this.repoConfig.metadataFile
            });
            return JSON.parse(content);
        } catch (err) {
            if (err.code === constants.ERR_FILE_NOT_FOUND) {
                this.logger.info(`Metadata file not found on branch ${this.repoConfig.branch}. Creating new file...`);
                const timestamp = new Date().toISOString();
                const metadataContent = {
                    created: timestamp,
                    lastModified: timestamp,
                    notes: []
                };
                const encodedContent = jsonToBase64(metadataContent);
                await this.publishContent({
                    content: encodedContent,
                    encoding: 'base64',
                    remotePath: this.repoConfig.metadataFile
                });
                this.logger.info(`New metadata file created at ${this.repoConfig.metadataFile}`);
                return metadataContent;
            }

            this.logger.error('Unknown error while fetching or creating sync metadata', err);
            throw err;
        }
    }

    /**
     * Update sync metadata file
     * @param {object} options
     * @param {string} options.content
     * @param {string} options.encoding
     * @returns {Promise<object>}
     */
    async updateSyncMetadata({ content, encoding }) {
        return this.publishContent({
            content,
            encoding,
            remotePath: this.repoConfig.metadataFile
        });
    }

    /**
     * Convenience function to sync file to github
     * @param {object} options
     * @param {string} options.filePath
     * @param {string} options.remotePath
     * @returns {Promise<*>}
     */
    async publishFile({ filePath, remotePath }) {
        const encoding = 'base64';
        const content = encodeFromUtf8(await promisify(fs.readFile)(filePath), encoding);
        return this.publishContent({ content, encoding, remotePath: (remotePath || basename(filePath)) });
    }

    /**
     * Convenience function to sync content to github
     * @param {object} options
     * @param {object} options.content
     * @param {object} options.encoding
     * @param {object} options.remotePath
     * @returns {Promise<object>}
     */
    async publishContent({ content, encoding, remotePath }) {
        const destinationFile = join(this.repoConfig.baseDir, remotePath);
        await this.client.fetchGithubUser();
        const headHash = await this.client.getHead();
        const treeHash = await this.client.getTreeHash(headHash);
        const blobHash = await this.client.createBlob({ content, encoding });
        const updatedTree = await this.client.createTree({
            baseTreeSHA: treeHash,
            remoteFilePath: destinationFile,
            blobSHA: blobHash
        });
        this.logger.debug(`Published blob. Updated tree hash: ${updatedTree}`);
        const commitHash = await this.client.commit({
            message: `Sync content to remote file ${remotePath}`,
            parentCommitSHA: headHash,
            treeSHA: updatedTree
        });
        this.logger.debug(`Commit ${commitHash} created!`);
        await this.client.updateHead(commitHash);
    }
};
