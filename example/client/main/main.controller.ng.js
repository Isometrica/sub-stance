'use strict'

angular.module('exampleApp')
.controller('MainCtrl', function($scope, $meteor) {
  $scope.things = $scope.$meteorCollection(Things);
  $meteor.session('thingsCounter').bind($scope, 'page');

  $scope.save = function() {
    if($scope.form.$valid) {
      $scope.things.save($scope.newThing);
      $scope.newThing = undefined;
    }
  };

  $scope.remove = function(thing) {
    $scope.things.remove(thing);
  };
});
