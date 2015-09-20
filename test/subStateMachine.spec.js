
describe("$subStateMachine", function() {

  'use strict';
  var $subStateMachine = '';

  beforeEach(module('isa.substance'));
  beforeEach(inject(function(_$subStateMachine_) {
    $subStateMachine = _$subStateMachine_;
  }));

  describe('.get', function() {

    it("should get registered subscription conf object", function() {
      $subStateMachine.state('routeName', 'subName');
      expect(angular.isObject($subStateMachine.get('routeName'))).toBe(true);
    });

    it("should get array of registered subscription conf objects", function() {
      $subStateMachine.state('routeName', 'subName', 'anotherSub', 'yetAnother');
      expect(angular.isArray($subStateMachine.get('routeName'))).toBe(true);
    });

  });

  describe(".state", function() {

    it("should register simple subscription conf", function() {
      $subStateMachine.state('routeName', 'subName');
      var subState = $subStateMachine.get('routeName');
      expect(subState.name).toBe('subName');
    });

    it("should register subscription conf with params", function() {
      $subStateMachine.state('routeName', {
        name: 'subName',
        params: ['routeParam1', 'routeParam2']
      });
      var subState = $subStateMachine.get('routeName');
      expect(subState.name).toBe('subName');
      expect(subState.params).toEqual(['routeParam1', 'routeParam2']);
    });

    it("should register subscription conf with autorun computation", function() {
      var block = function($meteor) {
        $meteor.subscribe('something', Session.get('reactiveParam'));
      };
      $subStateMachine.state('routeName', ['$meteor', block]);
      var subState = $subStateMachine.get('routeName');
      expect(subState.autorun).toEqual(['$meteor', block]);
    });

    it("should register array of subscription configurations", function() {
      var block = function($meteor) {
        $meteor.subscribe('something', Session.get('reactiveParam'));
      };
      $subStateMachine.state('routeName', 'sub1', 'sub2', {
        name: 'sub3',
        params: ['one', 'two']
      }, ['$meteor', block]);
      var states = $subStateMachine.get('routeName');
      expect(states).toEqual([
        { name: 'sub1' },
        { name: 'sub2' },
        { name: 'sub3', params: ['one', 'two'] },
        { autorun: ['$meteor', block] }
      ]);
    });

  });

  describe('.transition', function() {

    it("should start simple subscriptions", function() {

      $subStateMachine.state('routeName', 'subName');
      $subStateMachine.transition('routeName');
      expect();

    });

    xit("should start subscription with parameters from route state");
    xit("should start subscription with autorun block");
    xit("should re-run autorun blocks");
    xit("should resolve promise result once all subscriptions have started");
    xit("should discard unrequired old subscriptions");
    xit("should reuse old subscriptions");

  });

});
