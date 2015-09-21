
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
      // Map the subscription configuration for the next state to a set
      // of payloads that will be used to evaluate a subscription.
      var nextPayloads = _.map(nextConfs, function(conf) {
        return self._constructPayload(conf, nextParams);
      });
      // Set of payloads where the payload is an element of the next state
      // payloads and there does not exist some key in the current table of
      // subscriptions equal to the payload's hash key (i.e. )
      var payloadDelta = _.filter(nextPayloads, function(payload) {
        return !_.some(self._currentSubs, function(handle, key) {
          return payload.hashKey === key;
        });
      });
      // Stop all current subscriptions and remove them from the table if
      // there does not exist an element in the set of pending payloads
      // with an equal hash key.
      _.each(self._currentSubs, function(handle, key) {
        if (!_.some(nextPayloads, function(p) {
          return p.hashKey === key;
        })) {
          handle.stop();
          delete self._currentSubs[key];
        }
      });
      return payloadDelta;
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
      var statePayloads = self._migrate(stateName, stateParams);
      return $q.all(_.map(statePayloads, function(payload) {
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
