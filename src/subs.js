
angular
  .module('isa.substance')
  .service('$subs', $subs);

/**
 * @description
 * Singleton service holding that state of the application's subscriptions.
 * Transitioning to a new state will teardown subscriptions that are no longer
 * required a spin up new ones.
 *
 * @copyright Isometrica
 * @author Stephen Fortune
 */
function $subs($meteor, $q) {

  function dedubePayloads(payloads) {
    return _.uniq(payloads, function(payload) {
      return payload.hashKey;
    });
  }

  function serializePayloads(payloads) {
    return _.map(payloads, function(p) {
      var args;
      if (_.isObject(p)) {
        args = [p.name].concat(p.args);
      } else {
        args = [p];
      }
      return {
        hashKey: args.join(','),
        args: args
      };
    });
  }

  return {

    /**
     * Current active subsctipions - their keys uniquely identify the
     * subscription by their name and the parameters that they were
     * inovked with.
     *
     * @private
     * @var Object
     */
    _currentSubs: {},

    /**
     * Transition to a new subscription state.
     *
     * @param   payloads    Array of payloads
     * @return  Promise     Resolved when all required subscriptions are
     *          open.
     */
    transition: function(payloads) {
      var self = this, processed = serializePayloads(payloads);
      processed = dedubePayloads(processed);
      var pendingPayloads = self._migrate(processed);
      return $q.all(_.map(pendingPayloads, function(payload) {
        return $meteor.subscribe.apply($meteor, payload.args).then(function(handle) {
          self._currentSubs[payload.hashKey] = handle;
        });
      }));
    },

    /**
     * Computes the subscription payloads required for the next state, stops
     * the current subscriptions that aren't required for the next state and
     * returns a set of pending payloads that should be processed to complete
     * the transition.
     *
     * @private
     * @param   nextPayloads Array of $payloads
     * @return  Array        Array of pending $payloads
     */
    _migrate: function(nextPayloads) {
      var self = this;
      var delta = _.filter(nextPayloads, function(payload) {
        return !_.some(self._currentSubs, function(handle, key) {
          return payload.hashKey === key;
        });
      });
      _.each(self._currentSubs, function(handle, key) {
        if (!_.some(nextPayloads, function(p) {
          return p.hashKey === key;
        })) {
          handle.stop();
          delete self._currentSubs[key];
        }
      });
      return delta;
    }

  };

}

$subs.$inject = ['$meteor', '$q'];
