exports.trimSlashes = (str) => {
    if (str && typeof str === 'string') {
        return str.replace(/^\/|\/$/g, '');
    }
    return str;
};

exports.pathDepth = path => path.replace(/^\/|\/$/, '').split('/').length;
