
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
function $subs($meteor, $q, $rootScope, $timeout, $log, $injector) {

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

  var $Subs = {

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

    _discQs: {},

    _discard: function(key) {
      $log.debug('-- Posting discard for ' + key);
      var self = this;
      if (!self._discarding(key)) {
        $log.debug('-- Can discard');
        self._discQs[key] = $timeout(function() {
          $log.debug('--- Discarding ' + key);
          var sub = self._currentSubs[key];
          if (sub) {
            sub.stop();
            delete self._currentSubs[key];
          }
          self._purgeDisc(key);
        }, 10000);
      }
    },

    _discarding: function(key) {
      return this._discQs[key];
    },

    _purgeDisc: function(key) {
      delete this._discQs[key];
    },

    _ensureKeep: function(key) {
      $log.debug('-- Ensure ' + key + ' is kept.');
      var pr = this._discarding(key);
      if (pr) {
        $log.debug('-- Saved from delete!');
        $timeout.cancel(pr);
        this._purgeDisc(key);
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
      var self = this, processed = serializeArr(payloads);
      $log.debug('- Transitioning to ', _.map(processed, function(p) { return p.hashKey; }));
      return self._pushOp(function() {
        return self._migrate(processed);
      }, function(error) {
        $rootScope.$broadcast('$subTransitionError', error);
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
          self._ensureKeep(payload.hashKey);
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
      /// @note Is there a problem with atomicity here? E.g. if the timeout
      /// completes after _.some but before self._ensureKeep? Perhaps we
      /// could use some sort of mutex.
      /// @note If the $timeout for discard ops is 0, we'd actually be
      /// mutating `_currentSubs` while we enumerate it, which is bad.
      /// Just bear in mind.
      _.each(self._currentSubs, function(handle, key) {
        var compKeys = function(p) { return p.hashKey === key; },
            isNext = _.some(nextPayloads, compKeys);
        if (isNext) {
          self._ensureKeep(key);
        } else if (!handle.$$retainCount) {
          self._discard(key);
        }
        handle.$$stateReq = isNext;
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

  // TODO: How do we wrap the first op in a promise?
  // TODO: How do we integrate this with migrate and transition? The problem is
  // those methods want to give a guarnetee that the subs are open before pr is
  // resolved. We need some way for this to return a promise which is resolved
  // on first subscription invocation..
  // TODO: How / when do we clean this up?
  // -- If its a state required sub, cleanup on next state transition
  // -- If its retain count hits zero, like need subs
  // -- Is there a way that we can just listen to an event for when this is
  //    stopped and cleanup then ?
  $Subs._registerReactivePayload = function(payloadFn) {
    var rp = { fn: payloadFn };
    rp.comp = Tracker.autorun(function() {
      var newP = serializePayload($injector.invoke(rp.fn));
      // Invoke the new subscription and schedule a discard for
      // the old one
      Tracker.nonreactive(function() {
        if ($Subs._currentSubs[newP.hashKey]) {
          $Subs._ensureKeep(newP.hashKey);
        } else {
          $Subs._invokeSub(newP).then(function() {
            /// TODO: Only under certain conditions! E.g. !$$stateReq, etc.
            $Subs._discard(rp.p.hashKey);
            rp.p = newP;
          });
        }
      });
    });
    return rp;
  };

  return $Subs;

}

$subs.$inject = ['$meteor', '$q', '$rootScope', '$timeout', '$log', '$injector'];
