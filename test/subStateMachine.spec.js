
describe("$subStateMachine", function() {

  'use strict';
  var $subStateMachine;
  var $meteor;
  var $q;
  var $rootScope;

  beforeEach(module('isa.substance'));
  beforeEach(inject(function(_$subStateMachine_, _$meteor_, _$q_, _$rootScope_) {
    $subStateMachine = _$subStateMachine_;
    $meteor = _$meteor_;
    $q = _$q_;
    $rootScope = _$rootScope_;
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

    it("should start set of simple subscriptions", function() {

      spyOn($meteor, 'subscribe').and.returnValue($q.when({}));
      $subStateMachine.state('routeName', 'sub1', 'sub2');

      $subStateMachine.transition('routeName');
      $rootScope.$digest();

      expect($subStateMachine._currentSubs).toEqual([{}, {}]);
      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub1']);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub2']);

    });
    xit("should start single subscription");
    xit("should clear all subs on empty state conf");
    xit("should start subscription with parameters from route state");
    xit("should start subscription with autorun block");
    xit("should re-run autorun blocks");
    xit("should rollback to previous subs on error");
    xit("should resolve promise result once all subscriptions have started");
    xit("should discard unrequired old subscriptions");
    xit("should reuse old subscriptions");

  });

});
