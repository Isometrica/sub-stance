
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
    _currentSubs: {},
    subStates: {},
    state: function(stateName, sub) {
      var args = Array.prototype.slice.call(arguments);
      var subConfs = args.slice(1);
      this.subStates[stateName] = _.map(subConfs, createStateConf);
      return this;
    },
    transition: function(stateName, stateParams) {
      var stateConfs = this.get(stateName);
      var self = this;
      return $q.all(_.map(stateConfs, function(conf) {
        var payload = [conf.name].concat(_.map(conf.params, function(param) {
          return stateParams[param];
        }));
        return $meteor.subscribe.apply($meteor, payload).then(function(handle) {
          var hashKey = payload.join(',');
          self._currentSubs[hashKey] = handle;
        });
      }));
    },
    get: function(stateName) {
      return this.subStates[stateName];
    }
  };

}
$subStateMachine.$inject = ['$meteor', '$q'];
