/**
 * Check whether the note is empty
 * @param {Object} raw
 * @returns {Boolean}
 */
exports.isNoteEmpty = (raw) => {
    if (!raw) return true;
    const { content } = raw;
    if (!content) return true;
    return false;
};

/**
 * Sanitize note content
 * @param {Object} raw
 * @returns {Object}
 */
exports.sanitizeNote = (raw) => { // eslint-disable-line arrow-body-style
    return raw ? { ...raw, title: 'Empty Note', content: '_No Content_' } : raw;
};
