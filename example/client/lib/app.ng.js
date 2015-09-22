angular.module('exampleApp', [
  'angular-meteor',
  'ui.router',
  'ui.bootstrap',
  'isa.substance'
]);

onReady = function() {
  angular.bootstrap(document, ['exampleApp']);
};

if(Meteor.isCordova) {
  angular.element(document).on('deviceready', onReady);
} else {
  angular.element(document).ready(onReady);
}
