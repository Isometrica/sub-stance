
angular
  .module('isa.substance')
  .config(baseRouteConfig);

// Approach 1:
//
// Decoration:
// - Decorate builder's data function to merge the subs arrays with parents
// Trigger transitions:
// - In $stateChangeStart, append transition recipie to resolves.
// - Also ensure that other resolves come after it, i.e. depend on it

// Approach 2:
//
// - Wrap $stateProvider.state
// - Add add the resolves in there
// - How do we guarentee merge sub conf with parent?

function baseRouteConfig($stateProvider) {
  $stateProvider.state('subs', {
    abstract: true,
    template: '<ui-view/>',
    resolve: {
      subs: ['$subStateMachine', '$stateParams', function($subStateMachine, $stateParams) {
        return $subStateMachine.transition($stateParams.name, $stateParams.params);
      }]
    }
  });
}
