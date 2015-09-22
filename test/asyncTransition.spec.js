
describe("$asyncTransition", function() {

  'use strict';

  var $rootScope, transition, asyncFn, $state;

  beforeEach(module('isa.substance'));
  beforeEach(inject(function(_$rootScope_, $q, $asyncTransition, _$state_) {
    $rootScope = _$rootScope_;
    asyncFn = jasmine.createSpy('asyncFn');
    asyncFn.and.returnValue($q.resolve());
    transition = $asyncTransition(asyncFn);
    spyOn(_$state_, 'transitionTo');
    $state = _$state_;
  }));

  describe("ctor", function() {

    it("should construct callback function from promise", function() {
      expect(transition).toEqual(jasmine.any(Function));
    });

  });

  describe("invoke", function() {

    var e, toState = {some: 'state'}, toParams = {some: 'params'};
    beforeEach(function() {
      e = { preventDefault: angular.noop };
      spyOn(e, 'preventDefault');
      transition(e, toState, toParams);
      $rootScope.$digest();
    });

    it("should lock and start asyncFn on first invocation", function() {
      expect(e.preventDefault.calls.count()).toBe(1);
      expect(asyncFn.calls.count()).toBe(1);
    });

    it("should transition $state on completion of async operation", function() {
      expect($state.transitionTo.calls.argsFor(0)).toEqual(jasmine.arrayContaining([toState, toParams]));
    });

    it("should unlock on subsequent call", function() {
      transition(e, toState, toParams);
      expect(e.preventDefault.calls.count()).toBe(1);
    });

    xit("should emit routing error if operation fails");

  });

});
