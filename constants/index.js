module.exports = class Constants {
    constructor() {
        this.fileTypes = {
            MARKDOWN_NOTE: 'MARKDOWN_NOTE',
            SNIPPET_NOTE: 'SNIPPET_NOTE',
            MULTIMEDIA: 'MULTIMEDIA',
            RAW_CSON: 'RAW_CSON',
            UNKNOWN: 'UNKNOWN'
        };

        this.events = {
            FILE_CREATE_OR_UPDATE: 'FILE_CREATE_OR_UPDATE',
            FILE_DELETE: 'FILE_DELETE',
            FILE_CHANGE: 'FILE_CHANGE'
        };
    }
};
