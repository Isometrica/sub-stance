
angular
  .module('isa.substance')
  .config(decorateStateProvider)
  .run(stateChangeListener);

/**
 * @description
 * Decorates `$stateProvider`, allowing you to define the subscriptions
 * requires for each application state.
 *
 * @example
 *
 * ```Javascript
 *  $stateProvider
 *     .state('bookShop', {
 *       templateUrl: ...,
 *       url: '/book/shop/:filter/:page'
 *       resolve : {
 *         user: function($meteor) { return $meteor.requireUser(); }
 *       },
 *       data: {
 *         $subs: [
 *            { name: 'books', args: ['filter', 'page'] },
 *            'favouritedBooks'
 *          ]
 *       }
 *     });
 * ```
 *
 * _How does it work?_
 *
 * Decoration happens in 2 parts:
 *
 * - Registering a 'data' decorator with the `$stateProvider`. The ensures
 *   that `$subs` are merged correctly with their parent states' `$subs`.
 * - Listening to `$stateChangeStart` on the route scope, and appending
 *   a hidden dependency to the `resolve` object to block until the underlying
 *   `$subs.transition` is complete. We also guarentee that other dependencies
 *   are resolved _after_ the subscriptions by modifying their recipies.
 *
 * @see
 *
 * - Appending resolves: https://github.com/angular-ui/ui-router/issues/1278
 * - More on appending resolves: https://github.com/angular-ui/ui-router/issues/1165
 * - ui.router's $transition$: https://github.com/angular-ui/ui-router/issues/1257
 *
 * @copyright Isometrica
 * @author Stephen Fortune
 */

function decorateStateProvider($stateProvider, $rootScope) {

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

  $stateProvider.decorator('data', dataDecorateFn);

}
decorateStateProvider.$inject = ['$stateProvider'];

function stateChangeListener($rootScope, $subs, $log) {

  var subResolveKey = "$__subs";

  function dependsOnSubs(dep) {
    return ~dep.indexOf(subResolveKey);
  }

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

  function ensureSubs(e, toState, toParams, fromState, fromParams) {

    if (!toState.resolve) {
      $log.warn(
        'No resolve table for ' + toState.name + '. You must at least add an ' +
        'empty object: .state({... resolve: {});'
      );
      $subs.transition();
      return;
    }

    toState.resolve[subResolveKey] = function($subs) {
      var payload = evaluatedConf(toState.data.$subs, toParams);
      return $subs.transition(payload);
    };

    _.each(toState.resolve, function(resolve, key) {
      if (key === subResolveKey) {
        return;
      }
      if (_.isArray(resolve)) {
        if (!dependsOnSubs(resolve)) {
          resolve.splice(resolve.length - 1, 0, subResolveKey);
        }
      } else if (_.isFunction(resolve)) {
        if (!resolve.$inject) {
          resolve.$inject = [];
        } else if (dependsOnSubs(resolve.$inject)) {
          return;
        }
        resolve.$inject.push(subResolveKey);
      }
    });

  }

  $rootScope.$on('$stateChangeStart', ensureSubs);

}
stateChangeListener.$inject = ['$rootScope', '$subs', '$log'];
