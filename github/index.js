/**
 * Github Helper for Boostnote Github Sync. 
 * This helper currently supports creating/updating files only. Deleting files is not yet supported.
 */

 const requestFn = require('request');
 const fs = require('fs');
 const {resolve} = require('url');
 const {promisify} = require('util');

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
                    'Accept': 'application/json'
                },
                body,
                json: true
            });
            return response.body;
        }
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
        const { login } = await this.sendRequest({
            method: 'get',
            path: '/user'
        });

        this.userId = login;
    }

    /**
     * Get a reference to the HEAD of sync repository
     */
    async getHead() {
        const {object} = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repo.name}/git/refs/${this.defaultRefs}`,      // default notes branch is 'master'
        });

        return object.sha;
    }

    /**
     * Grab the tree information from the commit that HEAD points to
     * @param {string} hash 
     */
    async getCommitTreeSHA(hash) {
        const {message, tree} = await this.sendRequest({
            method: 'get',
            path: `/repos/${this.userId}/${this.repo.name}/git/commits/${hash}`
        });
        this.logger.debug(`fetched HEAD at : ${message} (${hash})`);
        
        return tree.sha;
    }

    /**
     * Post the file-to-by-synced as a git blob
     * @param {string} localFile 
     */
    async publishBlob(localFile) {
        const encoding = 'base64';
        const content = (await promisify(fs.readFile)(localFile)).toString(encoding); 
        const {sha} = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/blobs`,
            body: { content, encoding }
        });

        return sha;
    }

    /**
     * Create a tree containing new file
     * @param {object} options
     * @param {string} options.baseTreeSHA
     * @param {string} options.remoteFilePath
     * @param {string} options.blobSHA
     */
    async updateTree({baseTreeSHA, remoteFilePath, blobSHA}) {
        const GITHUB_BLOB_MODE = '100644';
        const GITHUB_BLOB_TYPE = 'blob';

        const {sha} = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/trees`,
            body: {
                'base_tree': baseTreeSHA,
                'tree': [
                  {
                    'path': remoteFilePath,
                    'mode': GITHUB_BLOB_MODE,
                    'type': GITHUB_BLOB_TYPE,
                    'sha': blobSHA
                  }
                ]
              }
        });
        
        return sha;
    }

    /**
     * Create a new commit after updating tree
     * @param {object} options 
     * @param {string} options.parentCommitSHA
     * @param {string} options.treeSHA
     * @param {string} options.message
     */
    async createCommit({parentCommitSHA, treeSHA, message}) {
        const {sha} = await this.sendRequest({
            method: 'post',
            path: `/repos/${this.userId}/${this.repo.name}/git/commits`,
            body: {
                'message': message,
                'author': {
                    'name': this.commitConfig.userName,
                    'email': this.commitConfig.userEmail,
                    'date': (new Date()).toISOString()
                },
                'parents': [parentCommitSHA],
                'tree': treeSHA
            }
        });

        return sha;
    }

    /**
     * Update head with new commit
     * @param {string} commitSHA 
     */
    async updateHead(commitSHA) {
        return this.sendRequest({
            method: 'patch',
            path: `/repos/${this.userId}/${this.repo.name}/git/refs/${this.defaultRefs}`,
            body: {
                sha: commitSHA,
                force: false
              }
        });
    }
}
