'use strict';

angular.module('exampleApp', ['isa.substance'])

.config(function($urlRouterProvider, $locationProvider) {
  $locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise('/');
});
