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
 * - Overrides `$state.transitionTo` and ensures that an underlying `$subs.transition`
 *   completes with the destination state's configuration before allowing the
 *   the transition to proceed. I've tried many other attempts to achieve this
 *   behaviour but decorating $state was the most robust solution that I could
 *   come up with. Until ui.router version 1.0.0 is released, this is what we're
 *   stuck with.
 *
 * @see https://github.com/christopherthielen/ui-router-extras/blob/master/src/transition.js
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

  function flattenConfArgs(subConf) {
    return [].concat.apply([], _.pluck(_.filter(subConf, _.isObject), 'args'));
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

  function transitionToDecorateFn($state, $subs, $log) {

    var transitionTo = $state.transitionTo;

    function extractParams(subConf, toParams) {
      var reqParams = flattenConfArgs(subConf);
      _.each(reqParams, function(paramName) {
        if (_.isUndefined(toParams[paramName])) {
          var param = $state.params[paramName];
          if (!param) {
            $log.warn('State param ' + paramName + ' doesn\'t exist but $subs requires it.');
          } else {
            toParams[paramName] = param;
          }
        }
      });
    }

    $state.transitionTo = function(to, toParams, options) {
      var args = Array.prototype.slice.call(arguments),
          tData = $state.get(to).data,
          payload;
      if (tData) {
        var subs = tData.$subs;
        extractParams(subs, toParams);
        payload = evaluatedConf(subs, toParams);
      }
      return $subs
        .transition(payload)
        .then(function() {
          return transitionTo.apply($state, args);
        });
    };

    return $state;

  }
  transitionToDecorateFn.$inject = ['$delegate', '$subs', '$log'];

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
function $subs($meteor, $q, $rootScope, $timeout) {

  function dedupePayloads(payloads) {
    return _.uniq(payloads, function(payload) {
      return payload.hashKey;
    });
  }

  function serializePayloads(payloads) {
    return dedupePayloads(_.map(payloads, function(p) {
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
    }));
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
     * Root promise used to queue to transition operations. Calling
     * `transition` does not actually process the transition immediately,
     * but adds an operation to the queue to perform the transition (FIFO)
     *
     * @private
     * @var Promise
     */
    _transQ: $q.when(true),

    _discardQs: {},

    _discardSub: function(key) {
      var self = this;
      if (!self._discardQs[key]) {
        self._discardQs[key] = $timeout(function() {
          var sub = self._currentSubs[key];
          if (sub) {
            sub.stop();
            delete self._currentSubs[key];
          }
          self._cleanUpDiscQ(key);
        }, 10000);
      }
    },

    _cleanUpDiscQ: function(key) {
      delete this._discardQs[key];
    },

    _invalidateDiscardQ: function(key) {
      var pr = this._discardQs[key];
      if (pr) {
        $timeout.cancel(pr);
        this._cleanUpDiscQ(key);
      }
    },

    /**
     * Transition to a new subscription state.
     *
     * @param   payloads    Array of payloads
     * @return  Promise     Resolved when all required subscriptions are
     *          open.
     */
    transition: function(payloads) {

      var self = this, processed = serializePayloads(payloads);

      self._transQ = self._transQ
        .then(function() {
          var pendingPayloads = self._migrate(processed);
          return $q.all(_.map(pendingPayloads, function(payload) {
            return self._invokeSub(payload).then(function(sub) {
              sub.$$stateReq = true;
            });
          }));
        })
        .catch(function(error) {
          $rootScope.$broadcast('$subTransitionError', error);
        });

      return self._transQ;

    },

    createDescriptorFor: function(key, sub) {
      var self = this;
      if(_.isUndefined(sub.$$retainCount)) {
        sub.$$retainCount = 1;
      } else {
        ++sub.$$retainCount;
      }
      return {
        _dead: false,
        stop: function() {
          if (this._dead) {
            throw new Error("Descriptor already dead.");
          }
          this._dead = true;
          --sub.$$retainCount;
          if (!sub.$$stateReq && !sub.$$retainCount) {
            self._discardSub(key);
          }
        }
      };
    },

    need: function() {
      var args = Array.prototype.slice.call(arguments),
          payload = { hashKey: args.join(','), args: args },
          self = this, sub = self._currentSubs[payload.hashKey];
      if (sub) {
        return $q.resolve(self.createDescriptorFor(payload.hashKey, sub));
      }
      self._transQ = self._transQ.then(function() {
        return self._invokeSub(payload).then(function(sub) {
          return self.createDescriptorFor(payload.hashKey, sub);
        });
      });
      return self._transQ;
    },

    /**
     * Invokes a subscription from the given payload.
     *
     * @private
     * @param   payload   Object
     * @return  Promise
     */
    _invokeSub: function(payload) {
      var self = this;
      return $meteor.subscribe.apply($meteor, payload.args)
        .then(function(handle) {
          self._currentSubs[payload.hashKey] = handle;
          return handle;
        });
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
        return !(self._currentSubs[payload.hashKey] || self._discardQs[payload.hashKey]);
      });
      /// @note Is there a problem with atomicity here? E.g. if the timeout
      /// completes after _.some but before self._invalidateDiscardQ ?
      _.each(self._currentSubs, function(handle, key) {
        var compKeys = function(p) { return p.hashKey === key; },
            keepSub = handle.$$retainCount || _.some(nextPayloads, compKeys),
            discarded = self._discardQs[key];
        if (keepSub && discarded) {
          self._invalidateDiscardQ(key);
        } else if(!keepSub && !discarded) {
          self._discardSub(key);
        }
      });
      return delta;
    }

  };

}

$subs.$inject = ['$meteor', '$q', '$rootScope', '$timeout'];
})(window, window.angular);