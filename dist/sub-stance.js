/* commonjs package manager support (eg componentjs) */
if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){
  module.exports = 'ui.router';
}

'use strict';(function (window, angular, undefined) {

angular
  .module('isa.substance', [
    'angular-meteor',
    'ui.router'
  ]);


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
 *         user: function($meteor, $__subs) { return $meteor.requireUser(); }
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

function stateChangeListener($rootScope, $subs, $log, $state) {

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

  }

  $rootScope.$on('$stateChangeStart', ensureSubs);

}
stateChangeListener.$inject = ['$rootScope', '$subs', '$log', '$state'];


angular
  .module('isa.substance')
  .service('$subs', $subs);

/**
 * @description
 * Singleton service holding that state of the application's subscriptions.
 * Transitioning to a new state will teardown subscriptions that are no longer
 * required a spin up new ones.
 *
 * @copyright Isometrica
 * @author Stephen Fortune
 */
function $subs($meteor, $q) {

  function dedubePayloads(payloads) {
    return _.uniq(payloads, function(payload) {
      return payload.hashKey;
    });
  }

  function serializePayloads(payloads) {
    return _.map(payloads, function(p) {
      var args;
      if (_.isObject(p)) {
        args = [p.name].concat(p.args);
      } else {
        args = [p];
      }
      return {
        hashKey: args.join(','),
        args: args
      };
    });
  }

  return {

    /**
     * Current active subsctipions - their keys uniquely identify the
     * subscription by their name and the parameters that they were
     * inovked with.
     *
     * @private
     * @var Object
     */
    _currentSubs: {},

    /**
     * Transition to a new subscription state.
     *
     * @param   payloads    Array of payloads
     * @return  Promise     Resolved when all required subscriptions are
     *          open.
     */
    transition: function(payloads) {
      var self = this, processed = serializePayloads(payloads);
      processed = dedubePayloads(processed);
      var pendingPayloads = self._migrate(processed);
      return $q.all(_.map(pendingPayloads, function(payload) {
        return $meteor.subscribe.apply($meteor, payload.args).then(function(handle) {
          self._currentSubs[payload.hashKey] = handle;
        });
      }));
    },

    /**
     * Computes the subscription payloads required for the next state, stops
     * the current subscriptions that aren't required for the next state and
     * returns a set of pending payloads that should be processed to complete
     * the transition.
     *
     * @private
     * @param   nextPayloads Array of $payloads
     * @return  Array        Array of pending $payloads
     */
    _migrate: function(nextPayloads) {
      var self = this;
      var delta = _.filter(nextPayloads, function(payload) {
        return !_.some(self._currentSubs, function(handle, key) {
          return payload.hashKey === key;
        });
      });
      _.each(self._currentSubs, function(handle, key) {
        if (!_.some(nextPayloads, function(p) {
          return p.hashKey === key;
        })) {
          handle.stop();
          delete self._currentSubs[key];
        }
      });
      return delta;
    }

  };

}

$subs.$inject = ['$meteor', '$q'];
})(window, window.angular);