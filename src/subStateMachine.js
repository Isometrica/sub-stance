
angular
  .module('isa.substance')
  .service('$subStateMachine', $subStateMachine);

function $subStateMachine($meteor, $q) {

  var createStateConf = function(sub) {
    if (angular.isArray(sub) || angular.isFunction(sub)) {
      return { autorun: sub };
    } else if (angular.isObject(sub)) {
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

  return {
    subStates: {},
    _currentSubs: [],
    state: function(stateName, sub) {
      var args = Array.prototype.slice.call(arguments);
      var subConfs = args.slice(1);
      this.subStates[stateName] = _.map(subConfs, createStateConf);;
    },
    transition: function(stateName) {
      var stateConfs = this.get(stateName);
      var self = this;
      return $q.all(_.map(stateConfs, function(conf) {
        var subArgs = [conf.name].concat(conf.params);
        return $meteor.subscribe.apply($meteor, subArgs).then(function(handle) {
          self._currentSubs.push(handle);
        });
      }));
    },
    get: function(stateName) {
      return this.subStates[stateName];
    }
  };

}
$subStateMachine.$inject = ['$meteor', '$q'];
