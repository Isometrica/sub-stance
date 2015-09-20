
angular
  .module('isa.substance')
  .service('$subStateMachine', $subStateMachine);

function $subStateMachine($meteor, $q) {

  var createStateConf = function(sub) {
    var conf;
    if (angular.isArray(sub) || angular.isFunction(sub)) {
      conf = { autorun: sub };
    } else if (angular.isObject(sub)) {
      conf = {
        name: sub.name,
        params: sub.params
      };
    } else {
      conf = { name: sub };
    }
    return conf;
  };

  return {
    subStates: {},
    _currentSubs: [],
    state: function(stateName, sub) {
      var args = Array.prototype.slice.call(arguments);
      var subConf;
      if (args.length > 2) {
        var subConfs = args.slice(1);
        subConf = _.map(subConfs, createStateConf);
      } else {
        subConf = createStateConf(sub);
      }
      this.subStates[stateName] = subConf;
    },
    transition: function(stateName) {
      var stateConfs = this.get(stateName);
      var self = this;
      return $q.all(_.map(stateConfs, function(conf) {
        return $meteor.subscribe(conf.name).then(function(handle) {
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
