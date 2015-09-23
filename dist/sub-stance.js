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
      console.log('-- Transition');
      if (lock) {
        lock = false;
        console.log('-- Locked, unlocking');
        return;
      }
      console.log('-- Locking and performing operation');
      event.preventDefault();
      var args = Array.prototype.slice.call(arguments);
      asyncFn.apply(null, args)
        .then(function() {
          $state.go(toState, toParams);
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
    var evaled = _.map(confs, function(conf) {
      if (_.isObject(conf)) {
        var cp = _.extend({}, conf);
        cp.args = _.map(conf.args, function(argName) {
          return params[argName];
        });
        return cp;
      }
      return conf;
    });
    console.log("Evaluated conf", evaled);
    return evaled;
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
        return !self._currentSubs[payload.hashKey];
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