
angular
  .module('isa.substance')
  .service('$asyncTransition', $asyncTransition);

function $asyncTransition($rootScope, $state) {
  return function(asyncFn) {
    var lock;
    return function(event, toState, toParams) {
      console.log('-- Event');
      if (lock) {
        lock = false;
        console.log('-- Unlocked');
        return;
      }
      console.log('-- Preventing and exec');
      event.preventDefault();
      var args = Array.prototype.slice.call(arguments);
      asyncFn.apply(null, args).then(function() {
        console.log('-- Done, locked and transitioned.');
        lock = true;
        $state.go(toState, toParams);
      });
    };
  };
}
$asyncTransition.$inject = ['$rootScope', '$state'];
