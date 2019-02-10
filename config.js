require('dotenv').config();
const process = require('process');
const Package = require('./package.json');

module.exports = {
    github: {
        api: {
            url: 'https://api.github.com',
            accessToken: process.env.GITHUB_TOKEN,
            userAgent: Package.name
        },
        repository: {
            name: process.env.GITHUB_REPO,
            branch: 'master',
            baseDir: '/',
            metadataFile: '.bgs_stats.json'
        },
        commit: {
            userName: 'Boostnote Github Sync',
            userEmail: 'boostnotesync@example.com'
        }
    },
    sync: {
        enabled: true,
        modes: {
            raw: false, // sync raw boostnote files
            parsed: true // sync parsed Markdown files
        }
    },
    watcher: {
        enabled: true,
        localDirs: [
            process.env.LOCAL_BOOSTNOTE_DIR
        ]
    }
};
