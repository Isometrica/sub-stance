'use strict'

angular.module('exampleApp')
.config(function($stateProvider, $subsProvider) {
  $stateProvider
  .state('main', {
    url: '/',
    templateUrl: 'client/main/main.view.ng.html',
    controller: 'MainCtrl',
    data: {
      $subs: ["things"]
    },
    resolve: {
      delay: function($timeout) {
        return $timeout(function() {
          console.log('Done delay..');
        }, 2000);
      }
    }
  });
});
