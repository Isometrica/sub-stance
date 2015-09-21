
angular
  .module('isa.substance')
  .config(baseRouteConfig);

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
