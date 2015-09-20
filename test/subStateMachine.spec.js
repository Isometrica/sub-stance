
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

    it("should register subscription conf with autorun computation", function() {
      var block = function($meteor) {
        $meteor.subscribe('something', Session.get('reactiveParam'));
      };
      $subStateMachine.state('routeName', ['$meteor', block]);
      var subState = $subStateMachine.get('routeName');
      expect(subState).toEqual([{
        autorun: ['$meteor', block]
      }]);
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
        { name: 'sub1', params: [] },
        { name: 'sub2', params: [] },
        { name: 'sub3', params: ['one', 'two'] },
        { autorun: ['$meteor', block] }
      ]);
    });

    xit("should return this");

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
      expect($subStateMachine._currentSubs).toEqual([{}, {}]);

    });

    it("should start subscriptions with parameters from route state", function() {

      spyOn($meteor, 'subscribe').and.returnValue($q.when({}));
      $subStateMachine.state('routeName', {
        name: 'sub',
        params: [1, 2, 3]
      }, {
        name: 'sub',
        params: [1, 2]
      });

      $subStateMachine.transition('routeName');

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub', 1, 2, 3]);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub', 1, 2]);

      $rootScope.$digest();
      expect($subStateMachine._currentSubs).toEqual([{}, {}]);

    });

    xit("should start subscription with autorun block");
    xit("should re-run autorun blocks");
    xit("should rollback to previous subs on error");
    xit("should resolve promise result once all subscriptions have started");
    xit("should discard unrequired subscriptions");
    xit("should reuse old subscriptions");
    xit("should clear all subs on empty state conf");

  });

});
