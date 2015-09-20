
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

    it("should get array of subscription conf objects", function() {
      $subStateMachine.state('routeName', 'subName', 'anotherSub', 'yetAnother');
      expect($subStateMachine.get('routeName')).toEqual(jasmine.any(Array));
    });

  });

  describe(".state", function() {

    it("should register simple subscription conf", function() {
      $subStateMachine.state('routeName', 'subName');
      var subState = $subStateMachine.get('routeName');
      expect(subState).toEqual([{
        name: 'subName',
        params: []
      }]);
    });

    it("should register subscription conf with params", function() {
      $subStateMachine.state('routeName', {
        name: 'subName',
        params: ['routeParam1', 'routeParam2']
      });
      var subState = $subStateMachine.get('routeName');
      expect(subState).toEqual([{
        name: 'subName',
        params: ['routeParam1', 'routeParam2']
      }]);
    });

    xit("should register subscription conf with autorun computation");

    it("should register array of subscription configurations", function() {
      $subStateMachine.state('routeName', 'sub1', 'sub2', {
        name: 'sub3',
        params: ['one', 'two']
      });
      var states = $subStateMachine.get('routeName');
      expect(states).toEqual([
        { name: 'sub1', params: [] },
        { name: 'sub2', params: [] },
        { name: 'sub3', params: ['one', 'two'] }
      ]);
    });

    it("should return this", function() {
      expect($subStateMachine.state('routeName')).toBe($subStateMachine);
    });

  });

  describe('.transition', function() {

    it("should return promise", function() {

      $subStateMachine.state('routeName');
      var pr = $subStateMachine.transition('routeName');
      expect(pr).toEqual(jasmine.any(Object));
      expect(pr.then).toEqual(jasmine.any(Function));

    });

    it("should start simple subscriptions", function() {

      spyOn($meteor, 'subscribe').and.returnValue($q.when({}));
      $subStateMachine.state('routeName', 'sub1', 'sub2');

      $subStateMachine.transition('routeName');

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub1']);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub2']);
      $rootScope.$digest();
      expect($subStateMachine._currentSubs).toEqual({
        'sub1': {},
        'sub2': {}
      });

    });

    it("should start subscriptions with parameters from route state", function() {

      spyOn($meteor, 'subscribe').and.returnValue($q.when({}));
      $subStateMachine.state('routeName', {
        name: 'sub',
        params: ['one', 'two', 'three']
      }, {
        name: 'sub',
        params: ['one', 'two']
      });

      $subStateMachine.transition('routeName', {
        one: 1,
        two: 2,
        three: 3
      });

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub', 1, 2, 3]);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub', 1, 2]);
      $rootScope.$digest();
      expect($subStateMachine._currentSubs).toEqual({
        'sub,1,2,3': {},
        'sub,1,2': {}
      });

    });

    it("should discard unrequired subscriptions", function() {



    });

    xit("should reuse old subscriptions");
    xit("should clear all subs on empty state conf");

    xit("should rollback to previous subs on error");
    xit("should start subscriptions with autorun blocks");
    xit("should re-run autorun blocks");
    // xit("should resolve promise result once all subscriptions have started");

  });

});
