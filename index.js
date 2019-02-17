const { Launcher, ConfigLoader } = require('@dpjayasekara/tscore');

const launcher = new Launcher({
    name: 'test'
});

launcher
    .withConfig(ConfigLoader.jsConfigLoader({
        filePath: './config.js'
    }))
    .withLoggerConfig({
        level: 'debug'
    })
    .module({ name: 'constants', path: './constants' })
    .module({ name: 'github', path: './github' })
    .module({ name: 'preprocessor', path: './preprocessor' })
    .module({ name: 'sync', path: './sync' })
    .module({ name: 'watcher', path: './watcher' })
    .start();
