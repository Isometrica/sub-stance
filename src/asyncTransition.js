
angular
  .module('isa.substance')
  .service('$asyncTransition', $asyncTransition);

/**
 * @description
 * Works around ui-router's lack of support for deffering state
 * transitions in an event listener.
 *
 * We tried a couple of approaches, including dynamically appending
 * resolves to the states in '$stateChangeStart', all of which
 * came up short due to the way resolves are handled by $stateProvider.
 * Reverted to an ugly, good-enough solution that prevents the event
 * from being processed and re-calles `$state.transitionTo` when the
 * async op has finished, faking lockstep. This occurs before we hit
 * the resolves and after the required subscriptions are openned.
 *
 * If the transition fails, an `$asyncTransitionError` will be
 * broadcasted on the `$rootScope` with the error.
 *
 * @see https://github.com/angular-ui/ui-router/issues/1257
 * @see https://github.com/angular-ui/ui-router/issues/1278
 * @see https://github.com/angular-ui/ui-router/issues/1165
 *
 * @copyright Isometrica
 * @author Stephen Fortune
 */
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
      asyncFn.apply(null, args)
        .then(function() {
          $state.transitionTo(toState, toParams);
        })
        .catch(function(error) {
          args.unshift('$asyncTransitionError');
          args.push(error);
          $rootScope.$broadcast.apply($rootScope, args);
        })
        .finally(function() {
          lock = true;
        });
    };
  };
}
$asyncTransition.$inject = ['$rootScope', '$state'];
