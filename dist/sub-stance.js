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

// Approach 1:
//
// Decoration:
// - Decorate builder's data function to merge the subs arrays with parents
// Trigger transitions:
// - In $stateChangeStart, append transition recipie to resolves.
// - Also ensure that other resolves come after it, i.e. depend on it
//
// Note: https://github.com/angular-ui/ui-router/issues/1165 you need
// resolve: {} to be able to append them in the event handler.
//
// Test this. If it works, all we need then is a service to actually create
// the subscriptions based on $subs. We don't need a provider to configure
// them !

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

function stateChangeListener($rootScope) {

  var subResolveKey = "$__subs";

  function ensureSubs(e, toState, toParams, fromState, fromParams) {

    if (!toState.resolve) {
      throw new Error("No resolve table.");
    }

    _.each(toState.resolve, function(resolve) {
      if (_.isArray(resolve)) {
        resolve.splice(resolve.length - 1, 0, subResolveKey);
      } else if (_.isFunction(resolve)) {
        if (!resolve.$inject) {
          resolve.$inject = [];
        }
        resolve.$inject.push(subResolveKey);
      }
    });

    toState.resolve[subResolveKey] = ['$subs', function($subs) {
      return $subs.transition(toState.name, toParams);
    }];

  }

  $rootScope.$on('$stateChangeStart', ensureSubs);

}
stateChangeListener.$inject = ['$rootScope'];

// Approach 2:
//
// - Wrap $stateProvider.state
// - Add add the resolves in there
// - How do we guarentee merge sub conf with parent?


angular
  .module('isa.substance')
  .provider('$subs', $subsProvider);

function $subsProvider() {

  var createStateConf = function(sub) {
    if (_.isArray(sub) || _.isFunction(sub)) {
      return { autorun: sub };
    } else if (_.isObject(sub)) {
      return {
        name: sub.name,
        params: sub.params
      };
    } else {
      return {
        name: sub,
        params: []
      };
    }
  };

  var builder = {

    /**
     * State configuration for the machine. Keys are the route state names
     * and values are arrays of configuration objects. A configuration object
     * has a `name` (subscription name) and an array of `params` (route state
     * parameters to take from the state and invoke the subscription with.)
     *
     * @private
     * @var Object
     */
    _subStates: {},

    /**
     * Register a subscription state; chain these calls.
     *
     * @param   stateName   String
     * @param   sub...      Strings | Objects
     * @return  this
     */
    state: function(stateName, sub) {
      var args = Array.prototype.slice.call(arguments);
      var subConfs = args.slice(1);
      this._subStates[stateName] = _.map(subConfs, createStateConf);
      return this;
    },

    /**
     * Get the subscription configuration array for a given stateName
     *
     * @param   stateName String
     * @return  Array
     */
    get: function(stateName) {
      return this._subStates[stateName] || [];
    }

  };
  _.extend(this, builder);

  function $subs($meteor, $q) {

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
       * Transition to a new state.
       *
       * @param   stateName   String
       * @param   stateParams Object
       * @return  Promise     Resolved when all required subscriptions are
       *          open.
       */
      transition: function(stateName, stateParams) {
        var self = this;
        var statePayloads = self._migrate(stateName, stateParams);
        return $q.all(_.map(statePayloads, function(payload) {
          return $meteor.subscribe.apply($meteor, payload.args).then(function(handle) {
            self._currentSubs[payload.hashKey] = handle;
          });
        }));
      },

      /**
       * Computes the subscription payloads required for the next state, stops
       * the current subscriptions that aren't required for the next route and
       * returns a set of payloads that should be processed for the transition
       * to be complete.
       *
       * @private
       * @param   nextName    String  Name of the next state
       * @param   nextParams  String  Dictionary of state params
       * @return  Array       Subscription payloads that must be processed
       */
      _migrate: function(nextName, nextParams) {
        var self = this;
        var nextConfs = builder.get(nextName);
        // Map the subscription configuration for the next state to a set
        // of payloads that will be used to evaluate a subscription.
        var nextPayloads = _.map(nextConfs, function(conf) {
          return self._constructPayload(conf, nextParams);
        });
        // Set of payloads where the payload is an element of the next state
        // payloads and there does not exist some key in the current table of
        // subscriptions equal to the payload's hash key.
        var payloadDelta = _.filter(nextPayloads, function(payload) {
          return !_.some(self._currentSubs, function(handle, key) {
            return payload.hashKey === key;
          });
        });
        // Stop all current subscriptions and remove them from the table if
        // there does not exist an element in the set of pending payloads
        // with an equal hash key.
        _.each(self._currentSubs, function(handle, key) {
          if (!_.some(nextPayloads, function(p) {
            return p.hashKey === key;
          })) {
            handle.stop();
            delete self._currentSubs[key];
          }
        });
        return payloadDelta;
      },

      /**
       * Constructs a 'subscription payload' object for a state configuration
       * object evaluated with a set of candidate state parameters.
       *
       * @private
       * @param  conf             Object
       * @param  candidateParams  Object
       * @return Object { args: [..], hashKey: 'name,arg1,arg2..' }
       */
      _constructPayload: function(conf, candidateParams) {
        var args = [conf.name].concat(_.map(conf.params, function(param) {
          return candidateParams[param];
        }));
        return {
          args: args,
          hashKey: args.join(','),
        };
      }
    };
  }
  $subs.$inject = ['$meteor', '$q'];

  this.$get = $subs;
}
})(window, window.angular);