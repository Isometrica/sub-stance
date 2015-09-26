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
    console.log('Data: for ' + state.name, state.data);
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
          toState = $state.get(to),
          payload;
      if (toState && toState.data) {
        var subs = toState.data.$subs;
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

  function serializePayload(p) {
    var args;
    if (_.isArray(p)) {
      args = p;
    } else if (_.isObject(p)) {
      args = [p.name].concat(p.args);
    } else {
      args = [p];
    }
    return {
      hashKey: args.join(','),
      args: args
    };
  }

  function serializeArr(arr) {
    return dedupePayloads(_.map(arr, serializePayload));
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
    _opsQ: $q.when(true),

    _pushOp: function(successFn, failFn) {
      this._opsQ = this._opsQ
        .then(successFn)
        .catch(failFn);
      return this._opsQ;
    },

    _discQs: {},

    _discard: function(key) {
      console.log('-- Posting discard for ' + key);
      var self = this;
      if (!self._discarding(key)) {
        console.log('-- Can discard');
        self._discQs[key] = $timeout(function() {
          console.log('--- Discarding ' + key);
          var sub = self._currentSubs[key];
          if (sub) {
            sub.stop();
            delete self._currentSubs[key];
          }
          self._purgeDisc(key);
        }, 10000);
      }
    },

    _discarding: function(key) {
      return this._discQs[key];
    },

    _purgeDisc: function(key) {
      delete this._discQs[key];
    },

    _ensureKeep: function(key) {
      console.log('-- Actually, keep ' + key);
      var pr = this._discarding(key);
      if (pr) {
        $timeout.cancel(pr);
        this._purgeDisc(key);
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
      var self = this, processed = serializeArr(payloads);
      console.log('- Transitioning to ', _.map(processed, function(p) { return p.hashKey; }));
      return self._pushOp(function() {
        return self._migrate(processed);
      }, function(error) {
        $rootScope.$broadcast('$subTransitionError', error);
      });
    },

    _createDescriptor: function(key, sub) {
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
          console.log('- Stopping descriptor ' + key, sub);
          if (!sub.$$stateReq && !sub.$$retainCount) {
            console.log('- Can discard this sub now');
            self._discard(key);
          }
        }
      };
    },

    need: function() {
      var args = Array.prototype.slice.call(arguments),
          payload = serializePayload(args),
          self = this;
      return self._pushOp(function() {
        var sub = self._currentSubs[payload.hashKey];
        if (sub) {
          self._ensureKeep(payload.hashKey);
          var descriptor = self._createDescriptor(payload.hashKey, sub);
          return $q.resolve(descriptor);
        }
        return self._invokeSub(payload).then(function(sub) {
          return self._createDescriptor(payload.hashKey, sub);
        });
      });
    },

    needBind: function(scope) {
      return this.need.apply(this, Array.prototype.slice.call(arguments, 1))
        .then(function(descriptor) {
          scope.$on('$destroy', function() {
            descriptor.stop();
          });
          return descriptor;
        });
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
      var pending = _.filter(nextPayloads, function(payload) {
        return !self._currentSubs[payload.hashKey];
      });
      /// Teardown subs that are no longer required by the application
      /// @note Is there a problem with atomicity here? E.g. if the timeout
      /// completes after _.some but before self._ensureKeep? Perhaps we
      /// could use some sort of mutex.
      /// @note If the $timeout for discard ops is 0, we'd actually be
      /// mutating `_currentSubs` while we enumerate it, which is bad.
      /// Just bear in mind.
      _.each(self._currentSubs, function(handle, key) {
        var compKeys = function(p) { return p.hashKey === key; },
            isNext = _.some(nextPayloads, compKeys);
        if (isNext) {
          self._ensureKeep(key);
        } else if (!handle.$$retainCount) {
          self._discard(key);
        }
        handle.$$stateReq = isNext;
      });
      /// Invoke new subs that are required, ensuring that they are marked
      /// as being required throughout the entire state (i.e. won't be discarded
      /// when their retain count hits 0).
      var qs = _.map(pending, function(payload) {
        return self._invokeSub(payload).then(function(sub) {
          sub.$$stateReq = true;
        });
      });
      return $q.all(qs);
    }

  };

}

$subs.$inject = ['$meteor', '$q', '$rootScope', '$timeout'];
})(window, window.angular);