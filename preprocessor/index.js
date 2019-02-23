const process = require('process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const cson = require('cson');
const { checksum } = require('./utils');
const { PreProcessError } = require('./errors');

const readFile = promisify(fs.readFile);
const getStat = promisify(fs.stat);

class PreProcessor {
    constructor({ container, logger }) {
        this.container = container;
        this.logger = logger;
        this.platform = process.platform;
        const { constants } = this.container.module('definitions');
        this.constants = constants;
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
            const fileContent = await readFile(changedFile);
            const fileChecksum = checksum(fileContent);

            if (ext === '.cson') {
                const data = cson.parse(fileContent.toString());
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
                    raw: data,
                    checksum: fileChecksum
                };
            }
            // handle any other file type
            return {
                event: this.constants.events.FILE_CREATE_OR_UPDATE,
                file: changedFile,
                type: this.constants.fileTypes.UNKNOWN,
                raw: fileContent.toString('base64'),
                checksum: fileChecksum
            };
        } catch (err) {
            // if err.code === 'ENOENT', it means that the 'changedFile' has been removed
            if (err.code === 'ENOENT') {
                return {
                    event: this.constants.events.FILE_DELETE,
                    file: changedFile
                };
            }
            throw new PreProcessError(`Error occurred while preprocessing event: ${err.message}`);
        }
    }
}

module.exports = PreProcessor;
