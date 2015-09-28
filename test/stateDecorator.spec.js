
describe("$stateProvider", function() {

  'use strict';

  var $stateProvider,
      $state,
      $injector,
      $subs,
      $log,
      $rootScope;

  beforeEach(module('isa.substance', function(_$stateProvider_) {
    /// @note I have assumed its OK to configure the $stateProvider
    /// and access the $state in the same context.
    $stateProvider = _$stateProvider_;
  }));
  beforeEach(inject(function(_$state_, _$rootScope_, _$injector_, _$log_, _$subs_, $q) {
    $state = _$state_;
    $rootScope = _$rootScope_;
    $injector = _$injector_;
    $log = _$log_;
    $subs = _$subs_;
    spyOn($subs, 'transition').and.returnValue($q.when({}));
  }));

  describe('.decorator(data)', function() {

    it("should merge data.$subs from parents", function() {

      $stateProvider
        .state('base', {
          abstract: true,
          template: '<ui-view/>',
          resolve : {},
          data: {
            $subs: ['sub1', 'sub2']
          }
        })
        .state('derived', {
          template: '<ui-view/>',
          parent: 'base',
          resolve : {},
          data: {
            $subs: ['sub3', 'sub4']
          }
        });

      expect($state.get('derived').data.$subs).toEqual(['sub1', 'sub2', 'sub3', 'sub4']);

    });

    it("should set to parent's data.$subs if empty", function() {

      $stateProvider
        .state('base', {
          abstract: true,
          template: '<ui-view/>',
          resolve : {},
          data: {
            $subs: ['sub1', 'sub2']
          }
        })
        .state('derived', {
          template: '<ui-view/>',
          parent: 'base',
          resolve : {},
          data: {}
        });

      expect($state.get('derived').data.$subs).toEqual(['sub1', 'sub2']);

    });

    it("should handle complex route heirarchies", function() {

      $stateProvider
        .state('base', {
          abstract: true,
          template: '<ui-view/>',
          resolve : {},
          data: {
            $subs: ['base1', 'base2']
          }
        })
        .state('branch1', {
          parent: 'base',
          abstract: true,
          template: '<ui-view/>',
          resolve : {},
          data: {
            $subs: ['branch1_1', 'branch1_2']
          }
        })
        .state('uncle', {
          parent: 'base',
          template: '<ui-view/>',
          resolve : {},
          data: {
            $subs: ['uncle']
          }
        })
        .state('sib1', {
          template: '<ui-view/>',
          parent: 'branch1',
          resolve : {},
          data: {
            $subs: ['branch1_sib1_1', 'branch1_sib1_2']
          }
        })
        .state('sib2', {
          template: '<ui-view/>',
          parent: 'branch1',
          resolve : {},
          data: {
            $subs: ['branch1_sib2_1', 'branch1_sib2_2']
          }
        });

      expect($state.get('sib1').data.$subs).toEqual(['base1', 'base2', 'branch1_1', 'branch1_2', 'branch1_sib1_1', 'branch1_sib1_2']);
      expect($state.get('sib2').data.$subs).toEqual(['base1', 'base2', 'branch1_1', 'branch1_2', 'branch1_sib2_1', 'branch1_sib2_2']);
      expect($state.get('uncle').data.$subs).toEqual(['base1', 'base2', 'uncle']);

    });

  });

  describe(".decorator(transitionTo)", function() {

    it("should build $subs.transition args from state", function() {

      $stateProvider
        .state('a', {
          template: '<ui-view/>',
          url: '/:param1/:param2',
          resolve : {},
          data: {
            $subs: [
              { name: 'sub1', args: ['param1'] },
              { name: 'sub2', args: ['param2', 'param1'] },
            ]
          }
        });

      $state.transitionTo('a', {
        param1: 'a',
        param2: 'b'
      });
      $rootScope.$digest();

      expect($subs.transition.calls.argsFor(0)).toEqual([[
        { name: 'sub1', args: ['a'] },
        { name: 'sub2', args: ['b', 'a'] },
      ]]);

    });

    it("should search for missing params in the current state", function() {

      $stateProvider
        .state('base', {
          template: '<ui-view/>',
          url: '/:param1',
        })
        .state('d1', {
          template: '<ui-view/>',
          parent: 'base',
          url: '/derived1',
        })
        .state('d2', {
          template: '<ui-view/>',
          parent: 'base',
          url: '/derived2/:param2',
          data: {
            $subs: [{ name: 'sub', args: ['param1', 'param2'] }]
          }
        });

      $state.transitionTo('d1', { param1: 'a' });
      $rootScope.$digest();

      $state.transitionTo('d2', { param2: 'b' });
      $rootScope.$digest();

      expect($subs.transition.calls.argsFor(1)).toEqual([[
        { name: 'sub', args: ['a', 'b'] },
      ]]);

    });

    it("should handle relative state names", function() {

      $stateProvider
        .state('base', {
          template: '<ui-view/>',
          url: '/base',
          data: {
            $subs: [ 'bSub' ]
          }
        })
        .state('base.d1', {
          template: '<ui-view/>',
          url: '/derived1',
          data: {
            $subs: [ 'd1Sub' ]
          }
        });

      $state.transitionTo('.d1', {}, { inherit: true, relative: $state.get('base') });
      $rootScope.$digest();

      expect($subs.transition.calls.argsFor(0)).toEqual([[
        'bSub',
        'd1Sub'
      ]]);

    });

    xit("should broadcast error if transition operation fails", function() {});

  });

});
