module.exports = function(config) {
  'use strict';
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      'bower_components/meteor-client-side/meteor-runtime-config.js',
      'bower_components/meteor-client-side/dist/meteor-client-side.bundle.js',
      'bower_components/angular/angular.js',
      'bower_components/angular-mocks/angular-mocks.js',
      'bower_components/angular-meteor/dist/angular-meteor.bundle.min.js',
      'bower_components/angular-ui-router/release/angular-ui-router.js',
      'src/**/*.js',
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
