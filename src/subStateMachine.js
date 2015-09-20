
angular
  .module('isa.substance')
  .service('$subStateMachine', $subStateMachine);

function $subStateMachine() {

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
    state: function(stateName, sub) {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      var subConf;
      if (args.length > 2) {
        var subConfs = args.slice(1);
        subConf = _.map(subConfs, createStateConf);
      } else {
        subConf = createStateConf(sub);
      }
      this.subStates[stateName] = subConf;
    },
    get: function(stateName) {
      return this.subStates[stateName];
    }
  };
}
