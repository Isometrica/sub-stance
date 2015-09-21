
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
