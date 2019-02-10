# Boostnote GitHub Sync

[![work](https://img.shields.io/badge/work-In_Progress-brightgreen.svg?style=flat-square)]() 

**Sync your [boostnotes](https://boostnote.io/) to a Github private repository.**

Boostnote Github Sync watches the changes in your boostnote notes, and automatically syncs the changes to a configured private repository in Markdown format.

### Prerequisites

- Create a private github repository for boostnotes
- Create a github [personal access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/). When creating the token, select scope `repo` in order to grant Boostnote GitHub Sync access to sync notes to your repository. 

### Setting up:

- Clone the repository
- Configure your github repository, personal access token and the local boostnotes directory in `.env` file.
- Configure other application settings in `config.js` file.
- Run `npm install`
- Run `npm start` to run the sync process.

### Limitations and Future work

- The current implementation is only one way. You can sync your notes in markdown format to GitHub, but not the other way around. This can be achieved by storing raw boostnote `.cson` files also in the repository.
- Since the current implementation filters markdown from boostnote `.cson` files, tags and other metadata from the notes will not be reflected in the Git Repository. Therefore, all files will be displayed in the same tree regardless of there locations in the local machine.
- Media files attached to the notes will not be synced in the current implementation. Therefore you might have broken images in your synced notes if you had images attached.

