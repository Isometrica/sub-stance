# SubStance

An angular.js service that creates and maintains Meteor.js subscriptions across state transitions.

### Problem Domain

- We have a complicated angular-meteor app, composed of many modules requiring a variety of meteor subscriptions.
- We don't have a consistent way to manage these subscriptions; we've found ourselves using a variety of the following approaches:

  1. In states
    - Example: __TODO__
    - Problems: __TODO__
  2. In controllers
    - Example: __TODO__
    - Problems: __TODO__
  3. Ad-hoc
    - Examples: __TODO__
    - Problems: __TODO__

- All of the drawbacks noted lead to bugs.
- Most of these approaches also require significant boilerplate, leading to code duplication and making it increasingly difficult to manage our ever-expanding codebase. Example: __TODO__
- This inconsistency coupled with the global nature of the subscriptions, makes it difficult to build new components without having to consider all the implicit dependencies that the component may have to subscriptions at different applications layers. Example: __TODO__

### Requirements

__TODO__

### Dependencies

- angular
- ui-router
- angular-meteor
