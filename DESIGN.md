# API Design Notes

### Idea 1

- A subscription state:
  - Singleton, containing all of the currently active application subscriptions.
  - Configure this provider with subscription specification for different states.
  - It should expose methods that do the following:
    - Transition to a new state - method that, when called, migrates the subscriptions to a new state. Returns promise.
    - Register subscription states.
  - It should expose the following properties:
    - Current state.
    - Current transition promise.
    - Current subscriptions.
  - Wraps `$meteor.subscribe` and `$meteor.autorun` to make its subscriptions.
- Decorator for $stateProvider
  - Looks for `subs` key and auto-configures the route with a dependency for transitioning.
  - The sub services will take care of closing old subs and starting new subs at one point (its transition method), so no need to register multiple setup / teardown handlers.
  - The next state transition will trigger the cleanup of previous subscriptions.
  - States with no subscriptions close everything?

### Idea 2

- Components that request subscriptions.
- With the current API, they can request subscriptions that will be cleared automatically on the next state transition.
- Perhaps if they are 'temporary' subscriptions, we could expose a helper method that binds a subscription to a scope and relinquishes it once all scopes that it relates to have been destroyed.
- I guess then, the problem is that we'd potential start opening / closing subs unnecessarily again.
- The benefit of the system at the moment is that we only stop subscriptions on state transition.

### Idea 3 - Needing

- `$subs.need(..)` and `$subs.needBind(...)`.
- Cases:
  - Need a subscription in a component with access to `$scope`, e.g. a directive or controller
  - Need full control over the lifetime of a subscription in a singleton service (even across state transitions)
- Going to focus on `needBind` for now; the case to keep a sub open forever in a service isn't a strong one.
- Subs required in transition set `state` flag to true.
- If a `needBind` request is made, a `retainCount` property is attached to the sub handle.
- On transition, subs are torn down if they not needed by the next state and have a retainCount of > 0
- If the retain count of a sub hits 0, it is torn down if it is not a `state` sub (i.e. isn't required globally across the entire state).
- `needBind` takes a `$scope` and listens to `$destroy` to decrement retain count.

### Idea 4 - Autorun

- As well as payloads, we can just pass a function to `need*` and `transition`.
- This function must return a subscription.
- This is wrapped in an autorun block i `$subs`.
- Probably will need to listen to the `Tracker.Deps.invalidate` it in the `$subs`? Or we could register an object in `_currentSubs` that has a property of the sub etc. They autorun block could just update the property? 
- Passed the `$meteor` service for convenience (considered making them invokable but that's overkill).
- They have random keys; will be torn down on transition (or under the appropriate retain conditions).
