describe('Log Extender Provider', function () {
    var noop = function () {},
        methods = ['error', 'warn', 'info', 'debug', 'log'],
        levels = {
            debug: 'debug',
            error: 'error',
            info: 'info',
            log: 'log',
            warn: 'warn',
            all: 'all',
            off: 'off'
        },
        types = {
            alert: 'alert',
            console: 'console',
            http: 'http'
        },
        url = 'api/log',
        urlBatch = 'api/log/batch',
        timeout = 1000;

    //console.log([].slice.call(arguments));
    //it('test', noop);

    describe('provider', function () {
        var _provider;

        beforeEach(function () {
            module('logExtender', function (logExtenderProvider) {
                _provider = logExtenderProvider;
            });
            inject(noop);
        });

        describe('levels', function () {
            it('should be defined levels', function () {
                expect(_provider.levels).toEqual(levels);
                expect(_provider.levels.error).toEqual(levels.error);
            });

            it('should be defined default level', function () {
                expect(_provider.level).toBeDefined();
                expect(_provider.level).toEqual(levels.all);
            });

            it('should change level', function () {
                _provider.setLevel(levels.error);
                expect(_provider.level).toEqual(levels.error);
            });
        });

        describe('appender', function () {
            it('should be defined appenderTypes', function () {
                expect(_provider.appenderTypes).toEqual(types);
                expect(_provider.appenderTypes.http).toEqual(types.http);
            });

            it('should be defined default appenderType', function () {
                expect(_provider.appenderType).toEqual(types.console);
            });

            it('should set correct appender', function () {
                _provider.setAppender();
                expect(_provider.appenderType).toEqual(types.console);

                _provider.setAppender(types.alert);
                expect(_provider.appenderType).toEqual(types.alert);
            });

            it('should throw an error if url is not passed', function () {
                expect(function () {
                    _provider.setAppender(types.http);
                }).toThrowError();
            });

            it('should be the same initialization', function () {
                _provider.setAppender(types.http, url);
                var _copy = angular.extend(_provider);

                _provider.setAppender({type: types.http, url: url});

                expect(_provider.type).toEqual(_copy.type);
                expect(_provider.url).toEqual(_copy.url);
            });
        });
    });

    describe('service', function () {
        describe('http appender format data', function () {
            var _service;

            beforeEach(function () {
                module('logExtender', function (logExtenderProvider) {
                    logExtenderProvider.setAppender({
                        appenderType: logExtenderProvider.appenderTypes.http,
                        url: url
                    });
                });

                inject(function (logExtender) {
                    _service = logExtender;
                });
            });

            it('should be defined logExtender service properties', function () {
                expect(angular.isFunction(_service.storageAvailability)).toBe(true);
                expect(angular.isObject(_service.appender)).toBe(true);
            });

            it('shouldn\'t be defined logExtenderProvider service properties', function () {
                expect(_service.$get).toBe(undefined);
                expect(_service.setAppender).toBe(undefined);
                expect(_service.levels).toBe(undefined);
            });

            it('should format data like LOG, INFO, DEBUG, WARN specific', function () {
                var method = 'log',
                    arguments = ['message'],
                    data = _service.appender.format(arguments, method);

                expect(data.level).toBe(methods.indexOf(method));
                expect(angular.isDate(new Date(data.timeStamp))).toBe(true);
                expect(data.url).toBeDefined();
                expect(data.url.length).toBeGreaterThan(0);
                expect(angular.isString(data.message)).toBe(true);
                expect(data.message).toBe(JSON.stringify(arguments));
                expect(data.exception).toBeUndefined();
            });

            it('should format data like ERROR specific', function () {
                var method = 'error',
                    message = 'message',
                    arguments,
                    data;

                try {
                    throw new Error(message);
                } catch (e) {
                    arguments = [e, message];
                }

                data = _service.appender.format(arguments, method);

                expect(data.level).toBe(methods.indexOf(method));
                expect(angular.isDate(new Date(data.timeStamp))).toBe(true);
                expect(data.url).toBeDefined();
                expect(JSON.parse(data.message)).toEqual([message, message]);
                expect(data.exception).toBeDefined();
                expect(data.exception.length).toBeGreaterThan(0);
                expect(/Error/.test(data.exception)).toBe(true);
            });
        });

        describe('http appender send data', function () {
            var $log,
                $httpBackend,
                $timeout,
                $rootScope,
                _provider,
                _service,
                httpAppenderMock,
                dataLog,
                dataError;

            beforeEach(function () {
                module('logExtender', function (logExtenderProvider) {
                    _provider = logExtenderProvider;
                    _provider.setAppender({
                        appenderType: _provider.appenderTypes.http,
                        url: url
                    });
                });
                module(function ($exceptionHandlerProvider) {
                    $exceptionHandlerProvider.mode('log');
                });

                inject(function (_$log_, _$httpBackend_, _$timeout_, _$rootScope_, _$window_, logExtender) {
                    $timeout = _$timeout_;
                    $log = _$log_;
                    $httpBackend = _$httpBackend_;
                    $rootScope = _$rootScope_;
                    _service = logExtender;
                    httpAppenderMock = jasmine.createSpyObj('logExtender.appender', ['format', 'log']);

                    dataError = {
                        level: methods.indexOf(levels.error),
                        timeStamp: new Date().toISOString(),
                        url: _$window_.location.href,
                        message: JSON.stringify('error message'),
                        exception: new Error(['exception message'])
                    };
                    dataLog = {
                        level: methods.indexOf(levels.log),
                        timeStamp: new Date().toISOString(),
                        url: _$window_.location.href,
                        message: JSON.stringify(['log message'])
                    };
                });
            });

            afterEach(function () {
                $httpBackend.verifyNoOutstandingExpectation();
                $httpBackend.verifyNoOutstandingRequest();

                $timeout.flush(timeout);
                $timeout.verifyNoPendingTasks();

                $httpBackend.resetExpectations();
            });

            function flush(count) {
                $timeout.flush();
                $httpBackend.flush(count);
            }

            it('should send formatted LOG data', function () {
                $log.log('log message');

                $httpBackend.expectPOST(url, function (data) {
                    data = JSON.parse(data);

                    expect(data.level).toEqual(dataLog.level);
                    expect(data.message).toEqual(dataLog.message);
                    expect(data.exception).toBeUndefined();
                    return data;
                }).respond();

                flush();
            });

            it('should be in priority batch url', function () {
                _provider.urlBatch = urlBatch;

                $httpBackend.expectPOST(urlBatch).respond();

                $log.error('error');
                flush();
            });

            it('should send data in 5 queries', function () {
                angular.forEach(methods, function (method) {
                    $log[method](method);
                    $httpBackend.expectPOST(url).respond();
                    flush();
                });
            });

            it('should send data in 1 query', function () {
                _provider.urlBatch = urlBatch;
                angular.forEach(methods, function (method) {
                    $log[method](method);
                });

                $httpBackend.expectPOST(urlBatch).respond();
                flush();
            });
        });

        describe('http appender send data with different levels', function () {
            var $log,
                $httpBackend,
                $timeout,
                $browser;

            beforeEach(function () {
                module('logExtender', function (logExtenderProvider) {
                    logExtenderProvider.setAppender({
                        appenderType: logExtenderProvider.appenderTypes.http,
                        level: logExtenderProvider.levels.warn,
                        urlBatch: urlBatch
                    });
                });

                inject(function (_$log_, _$httpBackend_, _$timeout_, _$browser_, logExtender) {
                    $timeout = _$timeout_;
                    $log = _$log_;
                    $httpBackend = _$httpBackend_;
                    $browser = _$browser_;
                });
            });

            afterEach(function () {
                $httpBackend.verifyNoOutstandingExpectation();
                $httpBackend.verifyNoOutstandingRequest();

                $timeout.flush(timeout);
                $timeout.verifyNoPendingTasks();

                $httpBackend.resetExpectations();
            });

            it('should send only 2 messages: ERROR, WARN', function () {
                angular.forEach(methods, function (method) {
                    $log[method](method);
                });

                $httpBackend.expectPOST(urlBatch, function (data) {
                    data = JSON.parse(data);

                    expect(data.length).toBe(2);
                    expect(data[0].level).toBe(methods.indexOf(levels.error));
                    expect(data[1].level).toBe(methods.indexOf(levels.warn));
                    return data;
                }).respond();

                $timeout.flush();
                $httpBackend.flush();
            });
        });


        describe('http appender send data with different amount of time', function () {
            var $log,
                $httpBackend,
                $timeout,
                $browser,
                $rootScope;

            beforeEach(function () {
                module('logExtender', function (logExtenderProvider) {
                    logExtenderProvider.setAppender({
                        appenderType: logExtenderProvider.appenderTypes.http,
                        urlBatch: urlBatch
                    });
                });

                inject(function (_$log_, _$httpBackend_, _$timeout_, _$browser_, _$rootScope_ , logExtender) {
                    $timeout = _$timeout_;
                    $log = _$log_;
                    $httpBackend = _$httpBackend_;
                    $browser = _$browser_;
                    $rootScope = _$rootScope_
                });

                jasmine.clock().install();
            });

            afterEach(function () {
                $httpBackend.verifyNoOutstandingExpectation();
                $httpBackend.verifyNoOutstandingRequest();

                $timeout.flush(timeout);
                $timeout.verifyNoPendingTasks();

                $httpBackend.resetExpectations();

                jasmine.clock().uninstall();
            });

            function _logAllMessages() {
                $log.error(new Error('ERROR1', 1), 'ERROR1', '1 request');
                $log.warn('warn1');
                $log.info('info1', 'add parameter', '1 request');

                try {
                    throw new Error('Invalid Controller', 'error4', '1 request');
                } catch (e) {
                    $log.error(e);
                }

                $timeout(function () {
                    $log.debug('debug1', 1, '1 request');
                    $log.log('log1', 1, '1 request');
                }, 300);

                $timeout(function () {
                    $log.error('error3', 3, '2 request');
                }, 1200);

                $timeout(function () {
                    $log.warn('warn2', '3 request');
                }, 2300);

                $timeout(function () {
                    $log.error(new TypeError('new TypeError'), '3 request');
                }, 2400);
            }

            it('should be 3 batch request', function () {
                _logAllMessages();

                $httpBackend.expectPOST(urlBatch, function (data) {
                    data = JSON.parse(data);

                    expect(data.length).toBe(6);
                    expect(data[0].level).toBe(methods.indexOf(levels.error));
                    expect(data[1].level).toBe(methods.indexOf(levels.warn));
                    expect(data[2].level).toBe(methods.indexOf(levels.info));
                    expect(data[3].level).toBe(methods.indexOf(levels.error));
                    expect(data[4].level).toBe(methods.indexOf(levels.debug));
                    expect(data[5].level).toBe(methods.indexOf(levels.log));
                    return data;
                }).respond();

                $timeout.flush(timeout);
                $httpBackend.flush(1);

                $httpBackend.expectPOST(urlBatch, function (data) {
                    data = JSON.parse(data);

                    expect(data.length).toBe(1);
                    expect(data[0].level).toBe(methods.indexOf(levels.error));
                    return data;
                }).respond();

                $timeout.flush(200);
                $timeout.flush(timeout);
                $httpBackend.flush(1);

                $httpBackend.expectPOST(urlBatch, function (data) {
                    data = JSON.parse(data);

                    expect(data.length).toBe(2);
                    expect(data[0].level).toBe(methods.indexOf(levels.error));
                    expect(data[1].level).toBe(methods.indexOf(levels.warn));
                    return data;
                }).respond();

                $timeout.flush(400);
                $timeout.flush(timeout);
                $httpBackend.flush(1);
            });
        });

        describe('http appender & localStorage', function () {
            var $log,
                $httpBackend,
                $timeout,
                $browser,
                $rootScope,
                storage,
                logExtender,
                _logRequestHandler,
                _msgs = [],
                _storageKey = 'log';

            beforeEach(function () {
                module('LocalStorageModule');
                module('logExtender', function (logExtenderProvider) {
                    logExtenderProvider.setAppender({
                        appenderType: logExtenderProvider.appenderTypes.http,
                        urlBatch: urlBatch,
                        storage: 'localStorageService'
                    });
                });

                inject(function (_$log_, _$httpBackend_, _$timeout_, _$browser_, _$rootScope_, localStorageService, _logExtender_) {
                    $timeout = _$timeout_;
                    $log = _$log_;
                    $httpBackend = _$httpBackend_;
                    $browser = _$browser_;
                    $rootScope = _$rootScope_;
                    storage = localStorageService;
                    logExtender = _logExtender_;
                });

                _msgs = [];
                spyOn(storage, 'get').and.callFake(function (key) {
                    if (key == _storageKey) {
                        return _msgs
                    }
                });
                spyOn(storage, 'set').and.callFake(function (key, values) {
                    if (key == _storageKey) {
                        _msgs = values
                    }
                });

                _logRequestHandler = $httpBackend.whenPOST(urlBatch).respond(500, {}, {}, 'Internal Server Error');
                jasmine.clock().install();
            });

            afterEach(function () {
                $httpBackend.verifyNoOutstandingExpectation();
                $httpBackend.verifyNoOutstandingRequest();

                $timeout.flush(timeout);
                $timeout.verifyNoPendingTasks();

                $httpBackend.resetExpectations();

                jasmine.clock().uninstall();
            });

            function _logAllMessages() {
                $log.error(new Error('ERROR1', 1), 'ERROR1', '1 request');
                $log.warn('warn1');
                $log.info('info1', 'add parameter', '1 request');

                try {
                    throw new Error('Invalid Controller', 'error4', '1 request');
                } catch (e) {
                    $log.error(e);
                }

                setTimeout(function () {
                    $log.debug('debug1', 1, '1 request');
                    $log.log('log1', 1, '1 request');
                }, 300);

                setTimeout(function () {
                    $log.error('error3', 3, '2 request');
                }, 1200);

                setTimeout(function () {
                    $log.warn('warn2', '3 request');
                    $log.error(new TypeError('new TypeError'), '3 request');
                }, 2300);
            }

            it('should be stored 3 batch requests', function () {
                var times = 3;

                _logAllMessages();

                for (var i = 0; i < times; i += 1) {
                    jasmine.clock().tick(timeout);
                    $timeout.flush();
                    $httpBackend.flush(1);
                }

                expect(storage.get.calls.count()).toEqual(times);
                expect(storage.set.calls.count()).toEqual(times);
            });

            it('should be stored 10 messages including server error', function () {
                _logAllMessages();

                jasmine.clock().tick(timeout * 3);
                $timeout.flush();
                $httpBackend.flush();

                expect(_msgs.length).toEqual(10);
                expect(_msgs[0].level).toEqual(methods.indexOf(levels.error));
                expect(JSON.parse(_msgs[0].message)[0]).toEqual('500 (Internal Server Error)');
            });

            it('should be sent 10 stored messages after connection established', function () {
                var messagesAmount = 10;

                /// 1) connection was down

                $httpBackend.expectPOST(urlBatch).respond(500);

                _logAllMessages();

                jasmine.clock().tick(timeout * 3);
                $timeout.flush();
                $httpBackend.flush();

                expect(_msgs.length).toEqual(messagesAmount);

                /// 2) connection established

                storage.get.calls.reset();
                //_logRequestHandler.respond(500); // WARN: it should impact but it doesn't. No matter which status would be.
                $httpBackend.expectPOST(urlBatch, function (data) {
                    expect(JSON.parse(data).length).toEqual(messagesAmount);
                    return data;
                }).respond(200);

                logExtender.appender.sendStorageData();

                $timeout.flush();
                $httpBackend.flush();

                expect(storage.get).toHaveBeenCalled();
                expect(storage.get.calls.count()).toEqual(1);
                expect(_msgs).toEqual(null);
            });
        });

    });
});