const process = require('process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const cson = require('cson');

const readFile = promisify(fs.readFile);
const getStat = promisify(fs.stat);

class PreProcessor {
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.platform = process.platform;
        this.constants = this.container.module('constants');
    }

    async processChangeSet(event, changedFile) {
        const { ext } = path.parse(changedFile);

        try {
            if (event === 'rename') {
                /**
                 * 'rename' event represents a file create or delete. So we need to explicitely
                 * determine whether this is a file create or delete.
                 * https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener
                */

                const isFile = (await getStat(changedFile)).isFile();

                if (!isFile) {
                    return this.logger.info(`path ${changedFile} is not a regular file. ignoring`);
                }
            }

            if (ext === '.cson') {
                const data = cson.parse(
                    (await readFile(changedFile)).toString(),
                );

                if (data && data.isTrashed) {
                    // If the note was deleted from BoostNote, isTrashed is set to true.
                    return {
                        event: this.constants.events.FILE_DELETE,
                        file: changedFile
                    };
                }

                return {
                    event: this.constants.events.FILE_CREATE_OR_UPDATE,
                    file: changedFile,
                    type: data.type || this.constants.fileTypes.UNKNOWN,
                    raw: data
                };
            }
            // handle any other file type
            const data = await readFile(changedFile);
            return {
                event: this.constants.events.FILE_CREATE_OR_UPDATE,
                file: changedFile,
                type: this.constants.fileTypes.UNKNOWN,
                raw: data
            };
        } catch (err) {
            // if err.code === 'ENOENT', it means that the 'changedFile' has been removed
            return {
                event: this.constants.events.FILE_DELETE,
                file: changedFile
            };
        }
    }
}

module.exports = PreProcessor;
