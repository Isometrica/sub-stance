
angular
  .module('isa.substance')
  .service('$subStateMachine', $subStateMachine);

function $subStateMachine($meteor, $q) {

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

  return {
    _currentSubs: {},
    subStates: {},
    state: function(stateName, sub) {
      var args = Array.prototype.slice.call(arguments);
      var subConfs = args.slice(1);
      this.subStates[stateName] = _.map(subConfs, createStateConf);
      return this;
    },
    _migrate: function(nextName, nextParams) {
      var self = this;
      var nextConfs = self.get(nextName);
      _.each(self._currentSubs, function(handle, key) {
        if (!_.some(nextConfs, function(nextConf) {
          var payload = self._constructPayload(nextConf, nextParams);
          return self._currentSubs[payload.hashKey]
        })) {
          handle.stop();
          delete self._currentSubs[key]
        }
      });
    },
    _constructPayload: function(conf, candidateParams) {
      var args = [conf.name].concat(_.map(conf.params, function(param) {
        return candidateParams[param];
      }));
      return {
        args: args,
        hashKey: args.join(','),
      };
    },
    transition: function(stateName, stateParams) {
      var self = this;
      var stateConfs = self.get(stateName);
      self._migrate(stateName, stateParams);
      return $q.all(_.map(stateConfs, function(conf) {
        var payload = self._constructPayload(conf, stateParams);
        return $meteor.subscribe.apply($meteor, payload.args).then(function(handle) {
          self._currentSubs[payload.hashKey] = handle;
        });
      }));
    },
    get: function(stateName) {
      return this.subStates[stateName];
    }
  };

}
$subStateMachine.$inject = ['$meteor', '$q'];
