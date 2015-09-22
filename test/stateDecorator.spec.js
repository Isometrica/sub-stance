
describe("$stateProvider", function() {

  'use strict';

  var $stateProvider,
      $state,
      $injector,
      $subsMock,
      $rootScope;

  beforeEach(module('isa.substance', function(_$stateProvider_, $provide) {
    $stateProvider = _$stateProvider_;
    $subsMock = { transition: angular.noop };
    $provide.value('$subs', $subsMock);
  }));
  beforeEach(inject(function(_$state_, _$rootScope_, _$injector_) {
    $state = _$state_;
    $rootScope = _$rootScope_;
    $injector = _$injector_;
  }));

  describe('decorator(data)', function() {

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

  describe("$stateChangeStart", function() {

    it("should append sub transition to resolves", function() {

      $stateProvider
        .state('a', {
          template: '<ui-view/>',
          resolve : {},
          data: {
            $subs: ['sub1', 'sub2']
          }
        });

      $state.transitionTo('a');
      $rootScope.$digest();

      expect($state.get('a').resolve.$__subs).toEqual(jasmine.any(Array));

    });

    it("should introduce dependency on transition to all other resolves", function() {

      function fnDep(dep1, dep2) {}
      fnDep.$inject = ['dep1', 'dep2'];

      function arrDepFn() {}
      var arrDep = ['dep1', 'dep2', arrDepFn];

      $stateProvider
        .state('a', {
          template: '<ui-view/>',
          resolve : {
            arrDep: arrDep,
            fnDep: fnDep
          },
          data: {
            $subs: ['sub1', 'sub2']
          }
        });

      $state.transitionTo('a');
      $rootScope.$digest();

      expect(arrDep).toEqual(['dep1', 'dep2', '$__subs', arrDepFn]);
      expect(fnDep.$inject).toEqual(['dep1', 'dep2', '$__subs']);

    });

    it("should not introduce dependency if already exists", function() {

      function fnDep(dep1, dep2) {}
      fnDep.$inject = ['dep1', 'dep2', '$__subs'];

      function arrDepFn() {}
      var arrDep = ['dep1', 'dep2', '$__subs', arrDepFn];

      $stateProvider
        .state('a', {
          template: '<ui-view/>',
          resolve : {
            arrDep: arrDep,
            fnDep: fnDep
          },
          data: {
            $subs: ['sub1', 'sub2']
          }
        });

      $state.transitionTo('a');
      $rootScope.$digest();

      expect(arrDep).toEqual(['dep1', 'dep2', '$__subs', arrDepFn]);
      expect(fnDep.$inject).toEqual(['dep1', 'dep2', '$__subs']);

    });

    it("should substitue route parameters for $subs args", inject(function($q) {

      spyOn($subsMock, 'transition').and.returnValue($q.when({}));
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

      var $__subs = $state.get('a').resolve.$__subs;
      $injector.invoke($__subs);

      expect($subsMock.transition.calls.argsFor(0)).toEqual([[
        { name: 'sub1', args: ['a'] },
        { name: 'sub2', args: ['b', 'a'] },
      ]]);

    }));

  });

});
