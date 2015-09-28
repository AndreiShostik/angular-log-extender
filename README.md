angular-log-extender
===
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
