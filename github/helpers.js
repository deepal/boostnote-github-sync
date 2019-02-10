exports.trimSlashes = (str) => {
    if (str && typeof str === 'string') {
        return str.replace(/^\/|\/$/g, '');
    }
}

exports.pathDepth = (path) => {
    return path.replace(/^\/|\/$/, '').split('/').length;
}