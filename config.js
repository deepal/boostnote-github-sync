require('dotenv').config();
const process = require('process');

module.exports = {
    github: {
        apiUrl: 'https://api.github.com',
        accessToken: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPO,
        branch: 'master',
        commits: {
            userName: 'Boostnote Github Sync',
            userEmail: 'boostnotesync@example.com'
        }
    },
    sync: {
        enabled: true
    },
    watcher: {
        enabled: true,
        localDirs: [
            process.env.LOCAL_BOOSTNOTE_DIR
        ]
    }
}