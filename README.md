# SubStance

An angular.js service that creates and maintains Meteor.js subscriptions across state transitions.

### Benefits

- Increase stability of client-side isa codebase: subscriptions are managed in a consistent way.
- Decrease boilerplate in client-side isa codebase (increase code health): just declare which subscriptions that you want for each route.
- Isolate subscription management functionality: track down and finding bugs relating to subscriptions in once place.
- Contributions to meteor community - marketing for Isometrica.

### Usage

Declare subscriptions required for your states:

```Javascript
.state('bookshop', {
  url: '/books/:bookId/:sort',
  templateUrl: ...,
  data: {
    $subs: [
      { name: 'books', args: ['sort'] },
      'favorites'
    ]
  }
});
```

Configure components that need certain subscriptions to function:

```Javascript
app.directive('commentsList', function($subs) {
	return {
		controller: function($scope, $element, $attrs, $transclude) {
      ...
      $subs.needsBind($scope, 'comments', $scope.someParam);
    }
  };
});

app.service('singleton', function($subs) {
  var descriptor = $subs.need('something');
  ...
  ...
  descriptor.stop();
});
```

Additional features:

- Support for inheriting `$sub` config in your states.
- Never opens more subscriptions than you need to.
- Subscription stopping is delayed by 10 seconds; requests for a subscriptions will reuse those which are queued for deletion automatically.

### Problem Domain

- We have a complicated angular-meteor app, composed of many modules requiring a variety of meteor subscriptions.
- We don't have a consistent way to manage these subscriptions; we've found ourselves using a variety of the following approaches:

###### In states

```Javascript
...
.state('module', {
  url: '/module/:moduleId',
  parent: 'organisation',
  abstract: true,
  template: '<ui-view/>',
  resolve: {
    moduleSub: function($meteor) {
      return $meteor.subscribe('modules');
    },
    ... Other resolves
  },
  onExit: function(moduleSub) {
    moduleSub.stop();
  }
});
```

Problems:

- If any of the other dependencies are not resolved, it seems as though `onExit` is never called and the subscription is never closed.
- It also seems as though `onExit` isn't necessarily called and completed before the next state transition starts.
- __TODO__: confirm the above.
- __TODO__: are the dependencies re-resolved and `onExit` called on navigation between child routes? I think they are.

###### In controllers

```Javascript
function AddressBookController($scope, $rootScope, $state, $modal, $meteor, organisation) {
  $scope.$meteorSubscribe('profileImages');
  ...
```

Problems:

- Other parallel controllers may make the same subscription, using unnecessary resources.

###### Ad-hoc

```Javascript
...
if (scope.type === 'Contact') {
  scope.$meteorSubscribe('contacts');
  scope.user = scope.$meteorObject(Contacts, scope.userId);
}
...
```
Problems:

  - If `$scope` is unavailable, e.g. in a factory or service, the subscription needs to be stopped manually.
  - Same issue as above; the same subscription may also be open in a parallel directive / service / factory.

----

- I've found that the drawbacks noted lead to leaks and other quirky bugs.
- Most of these approaches also require significant boilerplate, leading to code duplication and making it increasingly difficult to manage our ever-expanding codebase. Example:

```Javascript
...
.state('overview', {
  ...
  // Boilerplate
  resolve : {
    modulesSub: function($meteor) {
      return $meteor.subscribe('modules');
    }
  },
  onExit: function(modulesSub) {
    modulesSub.stop();
  }
})
.state('module', {
  ...
  // Boilerplate
  resolve: {
    moduleSub: function($meteor) {
      return $meteor.subscribe('modules');
    },
    module: function($meteor, $stateParams, moduleSub) {
      return Modules.findOne($stateParams.moduleId);
    }
  },
  onExit: function(moduleSub) {
    moduleSub.stop();
  }
});
```

- The the global nature of subscriptions makes it difficult to build new components without having to consider all the implicit dependencies that the component may have on subscriptions opened in other applications layer.

### Questions

- Does Meteor handle subscription cleanup / timeout?
- What happens if there are 2 subscriptions open to datasets that intersect, and one is closed?
- Do more research into how / when ui-router calls `onExit`.

### Requirements

- Define the subscriptions available within application states. _DONE_
- Allow arguments to be passed to subscription configuration. _DONE_
- Allow these subscriptions to be defined in an autorun computation.
- Expose an interface through which a component (service, controller, directive, etc.) can request a subscription. _DONE_
- Handle all subscription cleanup. _DONE_
- Only close / open new subscriptions when required. Consider:

  - Component A requires a subscription to S. Another component, B, has already requested a subscription to S. Through this interface, both A and B should receive the same subscription handle; only 1 subscription should ever be opened to S. _DONE_
  - Route A requires a set of subscriptions to be opened, one of which is S. Route B requires a set of subscriptions to be opened, one of which is also S. When the application transitions between the A and B states, a handle to S should never be closed and reopened. _DONE_

### References

- [SubsManager](https://github.com/kadirahq/subs-manager)
- [Iron.Router](https://github.com/iron-meteor/iron-router)

### Main Dependencies

- angular
- angular-meteor
- ui-router
