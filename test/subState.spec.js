
describe("$subState", function() {

  'use strict';
  var $subStateProvider;
  var $subState;
  var $meteor;
  var $q;
  var $rootScope;

  beforeEach(module('isa.substance'));
  beforeEach(inject(function(_$subStateProvider_, _$subState_, _$meteor_, _$q_, _$rootScope_) {
    $subStateProvider = _$subStateProvider_;
    $subState = _$subState_;
    $meteor = _$meteor_;
    $q = _$q_;
    $rootScope = _$rootScope_;
  }));

  describe('.get', function() {

    it("should get array of subscription conf objects", function() {
      $subStateProvider.state('routeName', 'subName', 'anotherSub', 'yetAnother');
      expect($subStateProvider.get('routeName')).toEqual(jasmine.any(Array));
    });

  });

  describe(".state", function() {

    it("should register simple subscription conf", function() {
      $subStateProvider.state('routeName', 'subName');
      var subState = $subStateProvider.get('routeName');
      expect(subState).toEqual([{
        name: 'subName',
        params: []
      }]);
    });

    it("should register subscription conf with params", function() {
      $subStateProvider.state('routeName', {
        name: 'subName',
        params: ['routeParam1', 'routeParam2']
      });
      var subState = $subStateProvider.get('routeName');
      expect(subState).toEqual([{
        name: 'subName',
        params: ['routeParam1', 'routeParam2']
      }]);
    });

    xit("should register subscription conf with autorun computation");

    it("should register array of subscription configurations", function() {
      $subStateProvider.state('routeName', 'sub1', 'sub2', {
        name: 'sub3',
        params: ['one', 'two']
      });
      var states = $subStateProvider.get('routeName');
      expect(states).toEqual([
        { name: 'sub1', params: [] },
        { name: 'sub2', params: [] },
        { name: 'sub3', params: ['one', 'two'] }
      ]);
    });

    it("should return this", function() {
      expect($subStateProvider.state('routeName')).toBe($subStateProvider);
    });

  });

  describe('.transition', function() {

    it("should return promise", function() {

      $subStateProvider.state('routeName');
      var pr = $subState.transition('routeName');
      expect(pr).toEqual(jasmine.any(Object));
      expect(pr.then).toEqual(jasmine.any(Function));

    });

    it("should start simple subscriptions", function() {

      spyOn($meteor, 'subscribe').and.returnValue($q.when({}));
      $subStateProvider.state('routeName', 'sub1', 'sub2');

      $subState.transition('routeName');

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub1']);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub2']);
      $rootScope.$digest();
      expect($subState._currentSubs).toEqual({
        'sub1': {},
        'sub2': {}
      });

    });

    it("should start subscriptions with parameters from route state", function() {

      spyOn($meteor, 'subscribe').and.returnValue($q.when({}));
      $subStateProvider.state('routeName', {
        name: 'sub',
        params: ['one', 'two', 'three']
      }, {
        name: 'sub',
        params: ['one', 'two']
      });

      $subState.transition('routeName', {
        one: 1,
        two: 2,
        three: 3
      });

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub', 1, 2, 3]);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub', 1, 2]);
      $rootScope.$digest();
      expect($subState._currentSubs).toEqual({
        'sub,1,2,3': {},
        'sub,1,2': {}
      });

    });

    it("should discard unrequired subscriptions", function() {

      var stop = jasmine.createSpy('stop');
      var subHandle = { stop: stop };
      spyOn($meteor, 'subscribe').and.returnValue($q.when(subHandle));
      $subStateProvider
        .state('r1', {
          name: 'sub1',
          params: ['a', 'b', 'c']
        }, {
          name: 'sub2',
          params: ['one', 'two']
        })
        .state('r2', {
          name: 'sub1',
          params: ['a', 'b', 'c']
        }, {
          name: 'sub3',
          params: ['b']
        });

      $subState.transition('r1', {
        a: 1,
        b: 2,
        c: 3,
        one: 4,
        two: 5
      });
      $rootScope.$digest();

      $subState.transition('r2', {
        a: 'a',
        b: 'b',
        c: 'c'
      });
      $rootScope.$digest();

      // TODO: Assert stop was called on the first 2 subs not the second 2
      expect(stop.calls.count()).toBe(2);
      expect($subState._currentSubs).toEqual({
        'sub1,a,b,c': subHandle,
        'sub3,b': subHandle
      });

    });

    it("should reuse old subscriptions", function() {

      var stop = jasmine.createSpy('stop');
      var subHandle = { stop: stop };
      spyOn($meteor, 'subscribe').and.returnValue($q.when(subHandle));
      $subStateProvider
        .state('r1', {
          name: 'sub1',
          params: ['a', 'b', 'c']
        }, {
          name: 'sub2',
          params: ['one', 'two', 'three']
        }, {
          name: 'destroyMe',
          params: ['one', 'two']
        })
        .state('r2', {
          name: 'sub1',
          params: ['one', 'two', 'three']
        }, {
          name: 'sub2',
          params: ['a', 'b', 'c']
        }, {
          name: 'replace',
          params: ['one']
        });

      $subState.transition('r1', {
        a: 1,
        b: 2,
        c: 3,
        one: 4,
        two: 5,
        three: 6
      });
      $rootScope.$digest();

      $subState.transition('r2', {
        a: 4,
        b: 5,
        c: 6,
        one: 1,
        two: 2,
        three: 3
      });
      $rootScope.$digest();

      // TODO: Assert stop was called only destroyMe
      expect(stop.calls.count()).toBe(1);
      expect($meteor.subscribe.calls.count()).toBe(4);
      expect($subState._currentSubs).toEqual({
        'sub1,1,2,3': subHandle,
        'sub2,4,5,6': subHandle,
        'replace,1': subHandle
      });
    });

    it("should destinguish between the same state names with different params", function() {

      var stop = jasmine.createSpy('stop');
      var subHandle = { stop: stop };
      spyOn($meteor, 'subscribe').and.returnValue($q.when(subHandle));
      $subStateProvider
        .state('r1', {
          name: 'sub1',
          params: ['a', 'b', 'c']
        }, {
          name: 'sub2',
          params: ['e', 'f', 'g']
        });

      $subState.transition('r1', {
        a: 1,
        b: 2,
        c: 3,
        e: 4,
        f: 5,
        g: 6
      });
      $rootScope.$digest();

      $subState.transition('r1', {
        a: 2,
        b: 3,
        c: 4,
        e: 5,
        f: 6,
        g: 7
      });
      $rootScope.$digest();

      expect($subState._currentSubs).toEqual({
        'sub1,2,3,4': subHandle,
        'sub2,5,6,7': subHandle
      });

    });

    it("should clear all subs on empty state conf", function() {

      var stop = jasmine.createSpy('stop');
      var subHandle = { stop: stop };
      spyOn($meteor, 'subscribe').and.returnValue($q.when(subHandle));

      $subStateProvider
        .state('r1', 'sub1', 'sub2')
        .state('r2');

      $subState.transition('r1');
      $rootScope.$digest();
      $subState.transition('r2');
      $rootScope.$digest();

      expect(stop.calls.count()).toBe(2);
      expect($subState._currentSubs).toEqual({});

      $subState.transition('r1');
      $rootScope.$digest();
      $subState.transition('r3');
      $rootScope.$digest();

      expect(stop.calls.count()).toBe(4);
      expect($subState._currentSubs).toEqual({});

    });

    xit("should rollback to previous subs on error");
    xit("should start subscriptions with autorun blocks");
    xit("should re-run autorun blocks");
    // xit("should resolve promise result once all subscriptions have started");

  });

});
