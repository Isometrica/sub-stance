
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
