const fs = require('fs');
const {promisify} = require('util');
const {join} = require('path');

const readDir = promisify(fs.readdir);
const getStats = promisify(fs.stat);

module.exports = class LocalWatcher {
    constructor(container, logger, config) {
        this.container = container;
        this.logger = logger;
        this.config = config;
        this.watch = this.watch.bind(this);
        this.start = this.start.bind(this);
    }

    async start(onChangeDetected) {
        await Promise.all(
            this.config.localDirs.map(async (localDir) => {
                await this.watch(localDir, onChangeDetected)
            })
        );
    }

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
                })
            );
        }
    }
}