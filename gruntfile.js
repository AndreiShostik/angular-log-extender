module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        karma: {
            main: {
                configFile: 'tests/karma.unit.global.config.js'
            }
        }
    });

    grunt.registerTask('karma-main', ['force:on', 'karma:main']);
};