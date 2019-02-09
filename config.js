require('dotenv').config();
const Package = require('./package.json');
const process = require('process');

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
            baseDir: '/'
        },
        commit: {
            userName: 'Boostnote Github Sync',
            userEmail: 'boostnotesync@example.com'
        }
    },
    sync: {
        enabled: true,
        modes: {
            raw: true,          // sync raw boostnote files
            parsed: true,       // sync parsed Markdown files
        }
    },
    watcher: {
        enabled: true,
        localDirs: [
            process.env.LOCAL_BOOSTNOTE_DIR
        ]
    }
}