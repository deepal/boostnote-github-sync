/**
 * Github Helper for Boostnote Github Sync.
 * This helper currently supports creating/updating files only. Deleting files is not yet supported.
 */

const fs = require('fs');
const { basename, dirname, join } = require('path');
const { promisify } = require('util');
const os = require('os');
const {
    trimSlashes,
    utf8ToBase64,
    jsonToBase64,
    getRemoteMarkdownPath,
    getRemoteRawPath
} = require('./helpers');
const { Client, constants, errorCode } = require('./client');

module.exports = class GithubHelper {
    /**
     * Create a Github Helper object
     * @param {*} container
     * @param {*} logger
     * @param {*} config
     */
    constructor({ container, logger, config }) {
        this.container = container;
        this.logger = logger;
        this.config = config;

        this.repoConfig = this.config.repository;
        this.apiConfig = this.config.api;
        this.commitConfig = this.config.commit;

        this.client = new Client({
            container,
            logger,
            config: {
                repoConfig: this.repoConfig,
                apiConfig: this.apiConfig,
                commitConfig: this.commitConfig
            }
        });
    }

    /**
     * Validate and initialize repository
     * @returns {Promise<void>}
     */
    async initializeRepository() {
        //  TODO: Should return the commit hash at HEAD so that it can be subsequently used by callers.
        try {
            if (!this.userId) await this.client.fetchGithubUser();
            await this.client.getHead();
        } catch (err) {
            if (err.code === errorCode.ERR_REPOSITORY_EMPTY) {
                this.logger.debug('Repository seems to be empty. Initializing with a README.md');
                await this.client.initializeReadMe();
                return;
            }

            throw new Error('Failed to initialize repository', err);
        }
    }

    /**
     * Fetch a file from the given branch
     * @param {object} options
     * @param {string} options.branch
     * @param {string} options.filePath
     * @returns {Promise<object>}
     */
    async fetchFile({ branch, filePath }) {
        await this.initializeRepository();
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
            this.logger.debug(`Fetched metadata file at ${this.repoConfig.metadataFile}`);
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
                await this.publishContent([
                    {
                        content: JSON.stringify(metadataContent),
                        remotePath: this.repoConfig.metadataFile
                    }
                ]);
                this.logger.info(`New metadata file created at ${this.repoConfig.metadataFile}`);
                return metadataContent;
            }

            this.logger.error('Unknown error while fetching or creating sync metadata', err);
            throw err;
        }
    }

    /**
     * Generate table of contents in readme
     * @param {object} metadata
     * @returns {Promise<object>}
     */
    generateReadMe(metadata) { // eslint-disable-line class-methods-use-this
        const { notes } = metadata;
        let markdownContent = '# Table of Contents\n';
        markdownContent += notes.reduce((out, { fileName, title }) => {
            const fileDir = dirname(fileName);
            const baseName = basename(fileName);
            const formattedFilePath = `./${trimSlashes(join(fileDir, encodeURI(baseName)))}`;
            return `${out}- [${title}](${formattedFilePath})\n`;
        }, '');
        return markdownContent;
    }

    /**
     * Convenience function to sync file to github
     * @param {object} options
     * @param {string} options.filePath
     * @param {string} options.remotePath
     * @returns {Promise<*>}
     */
    async publishFile({ filePath, remotePath }) {
        const content = (await promisify(fs.readFile)(filePath)).toString();
        return this.publishContent([
            {
                content,
                remotePath: (remotePath || basename(filePath))
            }
        ]);
    }

    async publishNote({ file, title, content, checksum }) {
        // Add note content to be published to github
        const remotePath = getRemoteMarkdownPath({ localPath: file, baseDir: this.repoConfig.markdownDir });
        const objectsToPublish = [{
            content,
            remotePath
        }];

        const newMetadata = {
            fileName: remotePath,
            title,
            checksum
        };

        const metadata = await this.fetchOrCreateSyncMetadata();
        const existingMetadata = metadata.notes.find(note => note.fileName === remotePath);
        const isNewNote = !existingMetadata;
        const isTitleChanged = !isNewNote && existingMetadata.title !== newMetadata.title;

        if (isNewNote) {
            this.logger.debug(`File ${remotePath} is not in metadata. Updating metadata.`);
            metadata.lastModified = new Date().toISOString();
            metadata.notes = [
                ...metadata.notes,
                newMetadata
            ];
        } else if (isTitleChanged) {
            this.logger.debug(`Note details already exist in metadata, but the note title has been changed to ${title}`);
            metadata.lastModified = new Date().toISOString();
            metadata.notes = metadata.notes.map((curr) => {
                if (curr.fileName === remotePath) {
                    return { ...curr, title, checksum };
                }
                return curr;
            });
        }

        if (isNewNote || isTitleChanged) {
            /* If the note is new or metadata has been changed, metadata should be republished,
             * and the table of contents should be updated.
            */
            objectsToPublish.push({
                content: JSON.stringify(metadata, null, 4),
                remotePath: this.repoConfig.metadataFile
            });

            this.logger.debug('Re-building table of contents');
            const readMeContent = this.generateReadMe(metadata);
            objectsToPublish.push({
                content: readMeContent,
                remotePath: 'README.md'
            });
        }

        return this.publishContent(objectsToPublish);
    }

    /**
     * Convenience function to sync content to github
     * @param {Array} objects
     * @returns {Promise<object>}
     */
    async publishContent(objects) {
        await this.initializeRepository();
        const headHash = await this.client.getHead();
        const treeHash = await this.client.getTreeHash(headHash);

        const blobs = await Promise.all(
            objects.map(async ({ content, remotePath }) => {
                const encodedContent = utf8ToBase64(content);
                const path = remotePath; // join(this.repoConfig.markdownDir, remotePath);
                this.logger.debug(`Creating blob ${path}`);
                const sha = await this.client.createBlob({ content: encodedContent, encoding: 'base64' });
                return { path, sha };
            })
        );

        this.logger.debug(`Creating tree from tree: ${treeHash}`);
        const newTree = await this.client.createTree({
            baseTreeSHA: treeHash,
            blobs
        });

        this.logger.debug(`Created tree: ${newTree}. Committing changes...`);
        const commitHash = await this.client.commit({
            message: `Sync notes from host: ${os.hostname()}`,
            parentCommitSHA: headHash,
            treeSHA: newTree
        });
        this.logger.debug(`Commit ${commitHash} created. Updating head...`);
        await this.client.updateHead(commitHash);
    }

    /**
     * Delete file from Sync Repository
     * TODO: Refactor required!
     * @param {string} localPath
     * @returns {string}
     */
    async deleteNote(localPath) {
        const rawFilePath = getRemoteRawPath({ localPath, baseDir: this.repoConfig.rawFilesDir });
        const markdownPath = getRemoteMarkdownPath({ localPath, baseDir: this.repoConfig.markdownDir });
        await this.initializeRepository();
        const headHash = await this.client.getHead();
        const treeHash = await this.client.getTreeHash(headHash);
        const { tree, truncated } = await this.client.getTree(treeHash, { recursive: true });
        if (truncated) {
            // TODO: Handle truncated result
            this.logger.warn('GitHub Repository too large. Could not delete note.');
        }

        const metadata = await this.fetchOrCreateSyncMetadata();
        const updatedMetadata = {
            ...metadata,
            lastModified: new Date().toISOString(),
            notes: metadata.notes.filter(note => note.fileName !== markdownPath)
        };
        const updatedReadme = this.generateReadMe(updatedMetadata);
        const metadataSHA = await this.client.createBlob({ content: jsonToBase64(updatedMetadata), encoding: 'base64' });
        const readMeSHA = await this.client.createBlob({ content: utf8ToBase64(updatedReadme), encoding: 'base64' });

        // Remote deleted file from the git tree and republish the tree with metadata and readme changes
        const newTree = tree
            .filter(subtree => subtree.type === 'blob'
                && subtree.path !== trimSlashes(markdownPath)
                && subtree.path !== trimSlashes(rawFilePath))
            .map((subtree) => {
                if (subtree.path === 'README.md') {
                    return { ...subtree, sha: readMeSHA };
                }
                if (subtree.path === trimSlashes(this.repoConfig.metadataFile)) {
                    return { ...subtree, sha: metadataSHA };
                }
                return subtree;
            });

        const newTreeSHA = await this.client.rebuildTree(newTree);
        const commitSHA = await this.client.commit({
            parentCommitSHA: headHash,
            treeSHA: newTreeSHA,
            message: `Sync deleted notes from host: ${os.hostname()}`
        });
        return this.client.updateHead(commitSHA);
    }
};
