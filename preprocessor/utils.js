const { createHmac } = require('crypto');

exports.checksum = (content, secret = '') => createHmac('sha256', secret).update(content).digest('hex');
