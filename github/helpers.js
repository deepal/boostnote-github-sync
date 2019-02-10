exports.trimSlashes = (str) => {
    if (str && typeof str === 'string') {
        return str.replace(/^\/|\/$/g, '');
    }
    return str;
};

exports.utf8ToBase64 = str => Buffer.from(str, 'utf-8').toString('base64');
exports.base64ToUtf8 = str => Buffer.from(str, 'base64').toString('utf-8');
exports.decodeToUtf8 = (content, encoding) => Buffer.from(content, encoding).toString('utf-8');
exports.encodeFromUtf8 = (content, encoding) => Buffer.from(content, 'utf-8').toString(encoding);
exports.jsonToBase64 = json => exports.utf8ToBase64(JSON.stringify(json, null, 4));
exports.base64ToJSON = str => JSON.parse(exports.base64ToUtf8(str));
exports.timestamp = () => new Date().toISOString();
exports.pathDepth = path => path.replace(/^\/|\/$/, '').split('/').length;
