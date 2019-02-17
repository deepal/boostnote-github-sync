const fs = require('fs');
const { promisify } = require('util');
const { join } = require('path');

const readDir = promisify(fs.readdir);
const getStats = promisify(fs.stat);

module.exports = class LocalWatcher {
    /**
     * Construct a local file watcher object
     * @param {Map} container
     * @param {Logger} logger
     * @param {Object} config
     */
    constructor(container, logger, config) {
        this.container = container;
        this.logger = logger;
        this.config = config;
        this.watch = this.watch.bind(this);
        this.start = this.start.bind(this);
    }

    /**
     * Start all watchers
     * @param {Function} onChangeDetected
     * @returns {Promise<*>}
     */
    async start(onChangeDetected) {
        await Promise.all(
            this.config.localDirs.map(async (localDir) => {
                await this.watch(localDir, onChangeDetected);
            }),
        );
    }

    /**
     * Watch directory
     * @param {string} directory
     * @param {Function} onChangeDetected
     * @returns {Promise<*>}
     */
    async watch(directory, onChangeDetected) {
        if ((await getStats(directory)).isDirectory()) {
            this.logger.info(`Watching directory: ${directory}`);
            fs.watch(directory, (event, fileName) => {
                const fullFilePath = join(directory, fileName);
                this.logger.debug(`change detected in ${fullFilePath}`);
                onChangeDetected(event, fullFilePath);
            });

            const contents = await readDir(directory);
            await Promise.all(
                contents.map(async (itemName) => {
                    const itemPath = join(directory, itemName);
                    // recursively watch the subdirectories
                    await this.watch(itemPath, onChangeDetected);
                }),
            );
        }
    }

    /**
     * Enumerate directory recursively and trigger callback for all items
     * @param {string} directory
     * @param {Function} onChangeDetected
     * @returns {void}
     */
    async enumerateDirectory(directory, onChangeDetected) {
        this.logger.info(`Enumerating directory: ${directory}`);
        const contents = await readDir(directory);

        await Promise.all(
            contents.map(async (item) => {
                const fullPath = join(directory, item);
                const stats = await getStats(fullPath);
                this.logger.debug(`triggering change action for ${fullPath}`);
                if (stats.isFile()) {
                    onChangeDetected('change', fullPath);
                    return;
                }
                if (stats.isDirectory()) await this.enumerateDirectory(fullPath, onChangeDetected);
            })
        );
    }
};
