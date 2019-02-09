const process = require('process');
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const cson = require('cson');

const readFile = promisify(fs.readFile);
const getStat = promisify(fs.stat);

const EVENTS = {
    FILE_CREATE_OR_UPDATE: 'FILE_CREATE_OR_UPDATE',
    FILE_DELETE: 'FILE_DELETE',
    FILE_CHANGE: 'FILE_CHANGE'
}

const FILE_TYPES = {
    NOTE: 'NOTE',
    SNIPPET: 'SNIPPET',
    MEDIA: 'MEDIA',
    UNKNOWN: 'UNKNOWN'
}

module.exports = class EventProcessor {
    constructor(container, logger) {
        this.logger = logger;
        this.platform = process.platform;
    }

    async processChangeSet(event, changedFile) {
        const { ext } = path.parse(changedFile);

        try {
            if (event === 'rename') {
                /**
                 * 'rename' event represents a file create or delete. So we need to explicitely 
                 * determine whether this is a file create or delete.
                 * https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener
                **/ 
                
                const isFile = (await getStat(changedFile)).isFile();

                if (!isFile) {
                    this.logger.info(`path ${changedFile} is not a regular file. ignoring`);
                    return;
                }
            }
            
            if (ext === '.cson') {
                const data = cson.parse(
                    (await readFile(changedFile)).toString()
                );
                
                return {
                    event: EVENTS.FILE_CREATE_OR_UPDATE,
                    file: changedFile,
                    type: data.type || FILE_TYPES.UNKNOWN,
                    raw: data
                };
            } else {
                // handle any other file type
                const data = await readFile(changedFile);
                return {
                    event: EVENTS.FILE_CREATE_OR_UPDATE,
                    file: changedFile,
                    type: FILE_TYPES.UNKNOWN,
                    raw: data
                };
            }                    
        } catch (err) {
            // if err.code === 'ENOENT', it means that the 'changedFile' has been removed
            return {
                event: EVENTS.FILE_DELETE,
                file: changedFile
            };
        }
    }
}
