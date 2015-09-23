
angular
  .module('isa.substance')
  .config(decorateStateProvider);

/**
 * @description
 * Decorates `$stateProvider`, allowing you to define which subscriptions
 * are required for each application state.
 *
 * @example
 *
 * ```Javascript
 *  $stateProvider
 *    .state('bookShop', {
 *      templateUrl: ...,
 *      url: '/book/shop/:filter/:page'
 *      data: {
 *        $subs: [
 *          { name: 'books', args: ['filter', 'page'] },
 *          'favouritedBooks'
 *        ]
 *      },
 *    });
 * ```
 *
 * **How does it work?**
 *
 * Decoration happens in 2 parts:
 *
 * - Registering a 'data' decorator with the `$stateProvider`. This ensures
 *   that `$subs` are merged correctly with their parent states' `$subs`.
 * - Listening to `$stateChangeStart` on the route scope, and deffering
 *   the event until the $subs have been transitioned (uses `$asyncTransition`).
 *
 * @copyright Isometrica
 * @author Stephen Fortune
 */

function decorateStateProvider($stateProvider, $provide) {

  function evaluatedConf(confs, params) {
    return _.map(confs, function(conf) {
      if (_.isObject(conf)) {
        var cp = _.extend({}, conf);
        cp.args = _.map(conf.args, function(argName) {
          return params[argName];
        });
        return cp;
      }
      return conf;
    });
  }

  function dataDecorateFn(state, parentFn) {

    if (state.parent && state.parent.data) {
      var pData = state.parent.data;
      if (pData.$subs) {
        if (!state.data) {
          state.data = {};
        }
        if (state.data.$subs) {
          state.data.$subs = pData.$subs.concat(state.data.$subs);
        } else {
          state.data.$subs = pData.$subs;
        }
      }
    }
    return parentFn(state);

  }

  function transitionToDecorateFn($state, $subs, $rootScope) {

    var transitionTo = $state.transitionTo;

    $state.transitionTo = function(to, toParams) {
      var args = Array.prototype.slice.call(arguments),
          tData = $state.get(to).data,
          payload;
      if (tData) {
        payload = evaluatedConf(tData.$subs, toParams);
      }
      return $subs.transition(payload)
        .then(function() {
          return transitionTo.apply($state, args);
        })
        .catch(function(error) {
          $rootScope.$broadcast.call($rootScope, '$subTransitionError', to, toParams, error);
        });
    };

    return $state;

  }
  transitionToDecorateFn.$inject = ['$delegate', '$subs', '$rootScope'];

  $provide.decorator('$state', transitionToDecorateFn);
  $stateProvider.decorator('data', dataDecorateFn);
}
decorateStateProvider.$inject = ['$stateProvider', '$provide'];
