
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
function $subs($meteor, $q, $rootScope, $log) {

  function dedupePayloads(payloads) {
    return _.uniq(payloads, function(payload) {
      return payload.hashKey;
    });
  }

  function serializePayload(p) {
    var args;
    if (_.isArray(p)) {
      args = p;
    } else if (_.isObject(p)) {
      args = [p.name].concat(p.args);
    } else {
      args = [p];
    }
    return {
      hashKey: args.join(','),
      args: args
    };
  }

  function serializeArr(arr) {
    return dedupePayloads(_.map(arr, serializePayload));
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
    _opsQ: $q.when(true),

    _pushOp: function(successFn, failFn) {
      this._opsQ = this._opsQ
        .then(successFn)
        .catch(failFn);
      return this._opsQ;
    },

    _discard: function(key) {
      var sub = this._currentSubs[key];
      if (sub) {
        sub.stop();
        delete this._currentSubs[key];
      }
      return this;
    },

    _clearAll: function() {
      var self = this;
      _.each(self._currentSubs, function(sub, key) {
        self._discard(key);
      });
    },

    /**
     * Transition to a new subscription state.
     *
     * @param   payloads    Array of payloads
     * @return  Promise     Resolved when all required subscriptions are
     *          open.
     */
    transition: function(payloads) {
      var self = this, processed = serializeArr(payloads);
      $log.debug('- Transitioning to ', _.map(processed, function(p) { return p.hashKey; }));
      return self._pushOp(function() {
        return self._migrate(processed);
      }, function() {
        self._clearAll();
      });
    },

    _createDescriptor: function(key, sub) {
      var self = this;
      if(_.isUndefined(sub.$$retainCount)) {
        sub.$$retainCount = 1;
      } else {
        ++sub.$$retainCount;
      }
      return {
        _dead: false,
        stop: function() {
          if (this._dead) {
            throw new Error("Descriptor already dead.");
          }
          this._dead = true;
          --sub.$$retainCount;
          $log.debug('- Stopping descriptor ' + key);
          if (!sub.$$stateReq && !sub.$$retainCount) {
            $log.debug('- Actually discarding this sub now');
            self._discard(key);
          }
        }
      };
    },

    need: function() {
      var args = Array.prototype.slice.call(arguments),
          payload = serializePayload(args),
          self = this;
      return self._pushOp(function() {
        var sub = self._currentSubs[payload.hashKey];
        if (sub) {
          var descriptor = self._createDescriptor(payload.hashKey, sub);
          return $q.resolve(descriptor);
        }
        return self._invokeSub(payload).then(function(sub) {
          return self._createDescriptor(payload.hashKey, sub);
        });
      });
    },

    needBind: function(scope) {
      return this.need.apply(this, Array.prototype.slice.call(arguments, 1))
        .then(function(descriptor) {
          scope.$on('$destroy', function() {
            descriptor.stop();
          });
          return descriptor;
        });
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
      var pending = _.filter(nextPayloads, function(payload) {
        return !self._currentSubs[payload.hashKey];
      });
      /// Teardown subs that are no longer required by the application
      var discardKeys = [];
      _.each(self._currentSubs, function(handle, key) {
        var compKeys = function(p) { return p.hashKey === key; },
            isNext = _.some(nextPayloads, compKeys);
        if (isNext || handle.$$retainCount) {
          handle.$$stateReq = true;
        } else {
          discardKeys.push(key);
        }
      });
      _.each(discardKeys, function(key) {
        self._discard(key);
      });
      /// Invoke new subs that are required, ensuring that they are marked
      /// as being required throughout the entire state (i.e. won't be discarded
      /// when their retain count hits 0).
      var qs = _.map(pending, function(payload) {
        return self._invokeSub(payload).then(function(sub) {
          sub.$$stateReq = true;
        });
      });
      return $q.all(qs);
    }

  };

}

$subs.$inject = ['$meteor', '$q', '$rootScope', '$log'];
