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
// Note:
// - https://github.com/angular-ui/ui-router/issues/1165
// - https://github.com/angular-ui/ui-router/issues/1278
// .. looks like you should add a default resolve: {} to be able to append
// them in the event handler.
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

function stateChangeListener($rootScope, $log) {

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
      return;
    }

    toState.resolve[subResolveKey] = ['$subs', function($subs) {
      var payload = evaluatedConf(toState.data.$subs, toParams);
      return $subs.transition(payload);
    }];

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
stateChangeListener.$inject = ['$rootScope', '$log'];

// Approach 2:
//
// - Wrap $stateProvider.state
// - Add add the resolves in there
// - How do we guarentee merge sub conf with parent?


angular
  .module('isa.substance')
  .service('$subs', $subs);

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