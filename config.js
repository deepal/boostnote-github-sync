require('dotenv').config();
const process = require('process');
const Package = require('./package.json');

module.exports = {
    github: {
        api: {
            url: 'https://api.github.com',
            accessToken: process.env.GITHUB_TOKEN, // Github Personal access token will be read from .env
            // User-Agent header is mandated by github API.
            userAgent: Package.name
        },
        repository: {
            // Github repo name will be read from .env
            name: process.env.GITHUB_REPO,
            // Remote branch to sync notes to
            branch: 'master',
            // Base directory in the git tree to store notes.
            baseDir: '/',
            // Metadata file location. Not recommended to be changed after the first sync run
            metadataFile: '.bgs_stats.json'
        },
        commit: {
            // Username and Email for Git sync commits. You can use anything you prefer.
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
            // Local boostnote directory. You can either load it from .env or
            // configure here as an array if you have more than one directory
            process.env.LOCAL_BOOSTNOTE_DIR
        ]
    }
};
