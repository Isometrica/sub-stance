module.exports = function(config) {
  'use strict';
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      'bower_components/angular/angular.js',
      'bower_components/**/*.min.js',
      'src/**/*.ng.js',
      'test/**/*.spec.js'
    ],
    exclude: [
    ],
    preprocessors: {},
    reporters: ['dots'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['Chrome']
  });
};
