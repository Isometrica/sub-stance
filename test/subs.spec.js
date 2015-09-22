
describe("$subs", function() {

  'use strict';

  var $subs,
      $meteor,
      $q,
      $rootScope;

  beforeEach(module('isa.substance'));
  beforeEach(inject(function(_$subs_, _$meteor_, _$q_, _$rootScope_) {
    $subs = _$subs_;
    $meteor = _$meteor_;
    $q = _$q_;
    $rootScope = _$rootScope_;
  }));

  describe('.transition()', function() {

    var stop, subHandle;

    beforeEach(function() {
      stop = jasmine.createSpy('stop');
      subHandle = { stop: stop };
      spyOn($meteor, 'subscribe').and.returnValue($q.when(subHandle));
    });

    it("should return promise", function() {

      var pr = $subs.transition(['sub']);
      $rootScope.$digest();

      expect(pr).toEqual(jasmine.any(Object));
      expect(pr.then).toEqual(jasmine.any(Function));

    });

    it("should start simple subscriptions", function() {

      $subs.transition(['sub1', 'sub2']);
      $rootScope.$digest();

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub1']);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub2']);
      expect($subs._currentSubs).toEqual({
        'sub1': subHandle,
        'sub2': subHandle
      });

    });

    it("should start subscriptions with arguments", function() {

      $subs.transition([
        { name: 'sub', args: [1, 2, 3] },
        { name: 'sub', args: [1, 2] }
      ]);
      $rootScope.$digest();

      expect($meteor.subscribe.calls.argsFor(0)).toEqual(['sub', 1, 2, 3]);
      expect($meteor.subscribe.calls.argsFor(1)).toEqual(['sub', 1, 2]);
      expect($subs._currentSubs).toEqual({
        'sub,1,2,3': subHandle,
        'sub,1,2': subHandle
      });

    });

    it("should discard unrequired subscriptions", function() {

      $subs.transition([
        { name: 'sub1', args: ['a', 'b', 'c'] },
        { name: 'sub2', args: ['one', 'two'] }
      ]);
      $rootScope.$digest();

      $subs.transition([
        { name: 'sub1', args: ['a', 'b', 'c'] },
        { name: 'sub3', args: ['b'] }
      ]);
      $rootScope.$digest();

      // TODO: Assert stop was called on sub2
      expect(stop.calls.count()).toBe(1);
      expect($subs._currentSubs).toEqual({
        'sub1,a,b,c': subHandle,
        'sub3,b': subHandle
      });

    });

    it("should reuse old subscriptions", function() {

      $subs.transition([
        { name: 'sub1', args: ['a', 'b', 'c'] },
        { name: 'sub2', args: ['one', 'two', 'three'] },
        { name: 'destroyMe', args: ['one', 'two']}
      ]);
      $rootScope.$digest();

      $subs.transition([
        { name: 'sub1', args: ['a', 'b', 'c'] },
        { name: 'sub2', args: ['one', 'two', 'three'] },
        { name: 'replace', args: ['one']}
      ]);
      $rootScope.$digest();

      // TODO: Assert stop was called on destroyMe
      expect(stop.calls.count()).toBe(1);
      expect($meteor.subscribe.calls.count()).toBe(4);
      expect($subs._currentSubs).toEqual({
        'sub1,a,b,c': subHandle,
        'sub2,one,two,three': subHandle,
        'replace,one': subHandle
      });

    });

    it("should clear all subs on empty state conf", function() {

      $subs.transition(['sub1', 'sub2']);
      $rootScope.$digest();

      $subs.transition([]);
      $rootScope.$digest();

      expect(stop.calls.count()).toBe(2);
      expect($subs._currentSubs).toEqual({});

      $subs.transition(['sub1', 'sub2']);
      $rootScope.$digest();

      $subs.transition();
      $rootScope.$digest();

      expect(stop.calls.count()).toBe(4);
      expect($subs._currentSubs).toEqual({});

    });

    it("should dedupe subscription payloads", function() {

      $subs.transition([
        'sub1', 'sub1', 'sub1', 'sub2',
        { name: 'sub3', args: [1, 2] },
        { name: 'sub3', args: [1, 2] },
        { name: 'sub3', args: [4, 5, 6] },
        { name: 'sub4', args: ['abc'] }
      ]);
      $rootScope.$digest();

      expect($subs._currentSubs).toEqual({
        'sub1': subHandle,
        'sub2': subHandle,
        'sub3,1,2': subHandle,
        'sub3,4,5,6': subHandle,
        'sub4,abc': subHandle
      });

      expect($meteor.subscribe.calls.count()).toBe(5);

    });

    xit("should rollback to previous subs on error");
    xit("should start subscriptions with autorun blocks");
    xit("should re-run autorun blocks");
    // xit("should resolve promise result once all subscriptions have started");

  });

  xdescribe('.add', function() {

    xit("should append new subscription to current state");
    xit("should return same objects on duplicate request");
    xit("should be cleared on transition");

  });

});
