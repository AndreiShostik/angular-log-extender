!function () {
    angular.module('logExtender', [])
        .provider('logExtender', function logExtenderProvider() {
            var methods = ['error', 'warn', 'info', 'debug', 'log'],
                types = {
                    alert: 'alert',
                    console: 'console',
                    http: 'http'
                },
                levels = {
                    debug: 'debug',
                    error: 'error',
                    info: 'info',
                    log: 'log',
                    warn: 'warn',
                    all: 'all',
                    off: 'off'
                },
                storageKey = 'log';

            var _this = angular.extend(this, {
                enabled: true,
                level: levels.all,
                appenderType: types.console,
                levels: levels,
                appenderTypes: types,
                setLevel: setLevel,
                setAppender: setAppender,
                timeout: 1000,
                storage: false
            });

            function setLevel(level) {
                this.level = level;
            }

            function setAppender(appenderType, url, urlBatch, timeout) {
                if (!arguments.length) return;
                if (angular.isObject(appenderType) && !appenderType.push) {
                    angular.extend(this, appenderType);
                } else {
                    if (appenderType) {
                        this.appenderType = appenderType;
                    }
                    if (appenderType === types.http) {
                        if (!url && !urlBatch) {
                            throw new Error('URL parameter needed for http appender.');
                        }
                        this.url = url;
                        this.urlBatch = urlBatch;

                        if (timeout) {
                            this.timeout = timeout;
                        }
                    }
                }
            }

            this.$get = function logExtenderFactory($injector, $window, $log, $timeout, $http) {
                this.getStorageService = getStorageService;

                var localStorageService = this.getStorageService();
                clearFunctions($log, methods);

                var _methods = getAvailableMethods(this.level);
                if (!_methods) {
                    return $log;
                }

                var appender = getAppender(this.appenderType);
                angular.forEach(_methods, function (method) {
                    $log[method] = function () {
                        var args = Array.prototype.slice.call(arguments),
                            data = appender.format(args, method);

                        appender.log(data, method);
                    };
                });

                // todo: logAppenderService
                function getAppender(appender) {
                    switch (appender) {
                        case types.alert:
                            return {
                                format: function (args, method) {
                                    var data = method.toUpperCase() + '\n';

                                    angular.forEach(args, function (arg, i) {
                                        if (!arg) return;
                                        if (arg instanceof Error) {
                                            arg = formatError(arg);
                                            data += arg.stack + '\n' + arg.message + '\n';
                                        } else {
                                            data += i + ': ' + (arg.trim ? arg.trim() : arg) + '\n';
                                        }
                                    });

                                    return data;
                                },
                                log: function (data) {
                                    $window.alert.call(null, data);
                                }
                            };
                        case types.console:
                            return {
                                format: function (args) {
                                    var data = [];

                                    angular.forEach(args, function (arg, i) {
                                        var prefix = (i > 0 ? '\n' : '');

                                        if (arg instanceof Error) {
                                            arg = formatError(arg);
                                            data.push(prefix);
                                            data.push(arg);
                                        } else {
                                            if (!arg) return;
                                            arg = arg.trim ? arg.trim() : arg;
                                            data.push(prefix + i + ': ');
                                            data.push(arg);
                                        }
                                    });

                                    return data;
                                },
                                log: function (data, method) {
                                    var call = detectBrowser(detectBrowser.browsers.firefox) ? 'call' : 'apply';
                                    $window.console[method][call]($window.console, data);
                                }
                            };
                        case types.http:
                            return {
                                format: function (args, method) {
                                    var data = {},
                                        messages = [],
                                        errorExist;

                                    angular.forEach(args, function (arg) {
                                        if (arg instanceof Error) errorExist = true;
                                    });

                                    if (errorExist) {
                                        angular.forEach(args, function (arg) {
                                            if (arg instanceof Error) {
                                                arg = formatError(arg);
                                                data = {
                                                    level: methods.indexOf(method),
                                                    timeStamp: new Date().toISOString(),
                                                    url: $window.location.href,
                                                    message: arg.message,
                                                    exception: arg.stack
                                                };
                                            } else {
                                                messages.push(arg);
                                            }
                                        });

                                        messages.unshift(data.message);
                                        data.message = JSON.stringify(messages);
                                    } else {
                                        data = {
                                            level: methods.indexOf(method),
                                            timeStamp: new Date().toISOString(),
                                            url: $window.location.href,
                                            message: JSON.stringify(args)
                                        };
                                    }

                                    return data;
                                },
                                log: (function () {
                                    var messages = [],
                                        promiseTimeout,
                                        promisePost,
                                        noInternet = false,
                                        postQueue = [],
                                        ownMsg,
                                        clearTimeoutPromise = function () {
                                            $timeout.cancel(promiseTimeout);
                                            promiseTimeout = null;
                                        },
                                        clearPostQueue = function () {
                                            postQueue = [];
                                        },
                                        sameOwnServerError = function (data) {
                                            if (data.level == methods.indexOf(levels.error)) {
                                                var msg = JSON.parse(data.message);

                                                if (!angular.isObject(msg) || !msg.push) return false;

                                                angular.forEach(msg, function (elem) {
                                                    if (elem.status && elem.text) {
                                                        msg = elem;
                                                    }
                                                });

                                                if (msg.status && msg.text) {
                                                    if (!ownMsg || (ownMsg.status != msg.status || ownMsg.text != msg.text)) {
                                                        ownMsg = msg;
                                                        messages.push(data);
                                                    }
                                                    return true;
                                                }
                                            }
                                            return false;
                                        };

                                    return function (data) {
                                        var __this = this;

                                        if (this.messages) { // note: remove it after removing log closure
                                            messages = this.messages;
                                            delete this.messages;
                                        }

                                        if (data) {
                                            if (sameOwnServerError(data)) return;
                                            messages.push(data);
                                        }

                                        if (!promiseTimeout && !promisePost/* && !noInternet*/) {
                                            promiseTimeout = $timeout(angular.noop, _this.timeout)
                                                .then(function () {
                                                    if (_this.urlBatch) {
                                                        promisePost = $http.post.apply($http, [_this.urlBatch, messages]);
                                                        messages = [];
                                                        clearTimeoutPromise();
                                                    } else {
                                                        promisePost = $http.post.apply($http, [_this.url, messages.shift()]);
                                                        clearTimeoutPromise();
                                                    }

                                                    postQueue.push(promisePost);
                                                    return promisePost;
                                                })
                                                .catch(function (errorData) {
                                                    var url = errorData.config.url;

                                                    if (url == _this.url || url == _this.urlBatch) {
                                                        errorData = errorData.config.data;
                                                        if (!errorData.length) {
                                                            errorData = [errorData];
                                                        }

                                                        var data = messages.concat(errorData);
                                                        __this.setToStorage(data);

                                                        //clearPostQueue();
                                                        messages = [];
                                                        postQueue = [];
                                                        noInternet = true;
                                                    }
                                                })
                                                .then(function () {
                                                    postQueue.shift();
                                                    promisePost = null;
                                                    return $timeout(angular.noop, _this.timeout);
                                                })
                                                .then(function () {
                                                    if (!postQueue.length && messages.length) {
                                                        __this.log(messages.shift());
                                                    }
                                                });
                                        } else {

                                        }
                                    }
                                })(),
                                setToStorage: function (data) {
                                    if (localStorageService) {
                                        var _data = localStorageService.get(storageKey) || [];
                                        _data.push.apply(_data, data);
                                        localStorageService.set(storageKey, _data);
                                    }
                                },
                                tryToConnect: function () {
                                    $http({ method: 'HEAD', url: '/' })
                                        .then(function () {
                                            //online = true;
                                        })
                                        .catch(function () {
                                            //online = false;
                                        })
                                },
                                sendStorageData: function () {
                                    if (localStorageService) {
                                        var data = localStorageService.get(storageKey);
                                        if (data && data.length) {
                                            this.messages = data;
                                            this.log();
                                        }
                                        localStorageService.set(storageKey, null);
                                    }
                                }
                            };
                    }
                }

                function formatError(arg) {
                    if (arg.stack) {
                        arg.stack = (arg.message && arg.stack.indexOf(arg.message) === -1)
                            ? 'Error: ' + arg.message + '\n' + arg.stack
                            : arg.stack;
                    } else if (arg.sourceURL) {
                        arg.message = arg.message + '\n' + arg.sourceURL + ':' + arg.line;
                    }
                    return arg;
                }

                function getAvailableMethods(level) {
                    if (!_this.enabled || level === levels.off) {
                    } else if (level === levels.all) {
                        return methods;
                    } else {
                        var index = methods.indexOf(level);
                        return methods.slice(0, index + 1);
                    }
                }

                function clearFunctions($log, methods) {
                    for (var index in methods) {
                        var method = methods[index];
                        $log[method] = angular.noop;
                    }
                }

                function getStorageService() {
                    var localStorageService = false;
                    if (this.appenderType === this.appenderTypes.http && this.storage) {
                        localStorageService = $injector.get(this.storage);
                    }
                    return localStorageService;
                }

                function detectBrowser(browser) {
                    var userAgent = $window.navigator.userAgent;

                    var browsers = {
                        chrome: /chrome/i,
                        safari: /safari/i,
                        firefox: /firefox/i
                    };

                    for (var key in browsers) {
                        if (browsers[key].test(userAgent)) {
                            return key === browser;
                        }
                    }
                }
                detectBrowser.browsers = {
                    chrome: 'chrome',
                    safari: 'safari',
                    firefox: 'firefox'
                };

                function _storageAvailability() {
                    return this.appenderType === this.appenderTypes.http && this.storage;
                }

                return {
                    appender: appender,
                    storageAvailability: function () { return _storageAvailability.bind(this) }
                };
            };
        });
}();

!function () {
    angular
        .module('logExtender')
        .config(function($httpProvider) {
            $httpProvider.interceptors.push(httpErrorInterceptor);
        });

    function httpErrorInterceptor($q, $log) {
        return {
            requestError: responseError,
            responseError: responseError
        };

        function responseError(rejection) {
            if (rejection.status >= 400) {
                rejection.data = rejection.data || {};
                $log.error(new Error(rejection.status + ' ('+ rejection.statusText +')'), rejection.data, { status: rejection.status, text: rejection.statusText });
                //$rootScope.$broadcast("httpError", rejection);
            }

            return $q.reject(rejection);
        }
    }
}();