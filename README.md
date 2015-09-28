angular-log-extender
===

[![Build Status](https://travis-ci.org/AndreiShostik/angular-log-extender.svg?branch=master)](https://travis-ci.org/AndreiShostik/angular-log-extender)
[![Coverage Status](https://coveralls.io/repos/AndreiShostik/angular-log-extender/badge.svg?branch=master&service=github)](https://coveralls.io/github/AndreiShostik/angular-log-extender?branch=master)

+ log to server
+ error levels
+ providers

# Configuration:

    angular
        .module('YourModule')
        .config(function (logExtenderProvider, ApiServerHostProvider) {
            logExtenderProvider.setLevel(logExtenderProvider.levels.warn);
            logExtenderProvider.setAppender({
                appenderType: logExtenderProvider.appenderTypes.http,
                urlBatch: ApiServerHostProvider.$get() + 'log/batch',
                storage: 'localStorageService'
            });
        })
        .run(function (logExtender) {
            if (logExtender.storageAvailability()) {
                logExtender.appender.sendStorageData();
            }
        });
