
angular
  .module('isa.substance')
  .service('$asyncTransition', $asyncTransition);

function $asyncTransition($rootScope, $state) {
  return function(asyncFn) {
    var lock;
    return function(event, toState, toParams) {
      if (lock) {
        lock = false;
        return;
      }
      event.preventDefault();
      var args = Array.prototype.slice.call(arguments);
      asyncFn.apply(null, args).then(function() {
        lock = true;
        $state.go(toState, toParams);
      });
    };
  };
}
$asyncTransition.$inject = ['$rootScope', '$state'];
