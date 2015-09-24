
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
function $subs($meteor, $q, $rootScope, $timeout) {

  function dedupePayloads(payloads) {
    return _.uniq(payloads, function(payload) {
      return payload.hashKey;
    });
  }

  function serializePayloads(payloads) {
    return dedupePayloads(_.map(payloads, function(p) {
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
    }));
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
     * Root promise used to queue to transition operations. Calling
     * `transition` does not actually process the transition immediately,
     * but adds an operation to the queue to perform the transition (FIFO)
     *
     * @private
     * @var Promise
     */
    _transQ: $q.when(true),

    _discardQs: {},

    _discardSub: function(key) {
      var self = this;
      if (!self._discardQs[key]) {
        self._discardQs[key] = $timeout(function() {
          var sub = self._currentSubs[key];
          if (sub) {
            sub.stop();
            delete self._currentSubs[key];
          }
          self._cleanUpDiscQ(key);
        }, 10000);
      }
    },

    _cleanUpDiscQ: function(key) {
      delete this._discardQs[key];
    },

    _invalidateDiscardQ: function(key) {
      var self = this, discardQ = self._discardQs[key];
      if (discardQ) {
        $timeout.cancel(discardQ);
        self._cleanUpDiscQ(key);
      }
    },

    /**
     * Transition to a new subscription state.
     *
     * @param   payloads    Array of payloads
     * @return  Promise     Resolved when all required subscriptions are
     *          open.
     */
    transition: function(payloads) {

      var self = this, processed = serializePayloads(payloads);

      self._transQ = self._transQ
        .then(function() {
          var pendingPayloads = self._migrate(processed);
          return $q.all(_.map(pendingPayloads, function(payload) {
            return self._invokeSub(payload).then(function(sub) {
              sub.state = true;
            });
          }));
        })
        .catch(function(error) {
          $rootScope.$broadcast('$subTransitionError', error);
        });

      return self._transQ;

    },

    createDescriptorFor: function(key, sub) {
      var self = this;
      if(sub.retainCount) {
        ++sub.retainCount;
      } else {
        sub.retainCount = 0;
      }
      return {
        stop: function() {
          --sub.retainCount;
          if (!sub.state) {
            self._discardSub(key);
          }
        }
      };
    },

    need: function() {
      var args = Array.prototype.slice.call(arguments),
          payload = serializePayloads([args.slice(0)]),
          self = this, sub = self._currentSubs[payload.hashKey];
      if (sub) {
        return $q.resolve(self.createDescriptorFor(sub));
      }
      self._transQ = self._transQ.then(function() {
        return self._invokeSub(payload[0]).then(function(sub) {
          return self.createDescriptorFor(sub);
        });
      });
      return self._transQ;
    },

    /**
     * Invokes a subscription from the given payload.
     *
     * @private
     * @param   payload   Object
     * @return  Promise
     */
    _invokeSub: function(payload) {
      var self = this;
      return $meteor.subscribe.apply($meteor, payload.args)
        .then(function(handle) {
          self._currentSubs[payload.hashKey] = handle;
          return handle;
        });
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
        return !self._currentSubs[payload.hashKey];
      });
      /// @note Is there a problem with atomicity here? E.g. if the timeout
      /// completes after _.some but before self._invalidateDiscardQ ?
      _.each(self._currentSubs, function(handle, key) {
        var compKeys = function(p) { return p.hashKey === key; };
        if (_.some(nextPayloads, compKeys)) {
          self._invalidateDiscardQ(key);
        } else if(!handle.retainCount) {
          self._discardSub(key);
        }
      });
      return delta;
    }

  };

}

$subs.$inject = ['$meteor', '$q', '$rootScope', '$timeout'];
