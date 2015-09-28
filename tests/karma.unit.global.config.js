var baseConfig = require('./base-config.js'),
    path = require('path');

module.exports = function (config) {
    'use strict';

    config.set({
        autoWatch: true,
        basePath: './',
        frameworks: ['jasmine'],
        files: baseConfig.libraries.concat([
            '../app/logExtender.js',
            './**.js'
        ]),
        exclude: [],
        port: 8067,
        browsers: [
            'PhantomJS'
            //'Chrome',
            //'Firefoox',
            //'Opera',
            //'IE'
        ],
        reporters: ['spec'],
        plugins: [
            'karma-jasmine',
            'karma-spec-reporter',
            'karma-phantomjs-launcher',
            'karma-chrome-launcher',
            'karma-firefox-launcher'
        ],
        singleRun: true,
        colors: true,
        // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
        //logLevel: config.LOG_ERROR
    });
};
