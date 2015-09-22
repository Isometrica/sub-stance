
describe("$stateProvider", function() {

  'use strict';

  var $stateProvider,
      $state,
      $rootScope;

  beforeEach(module('isa.substance', function(_$stateProvider_) {
    $stateProvider = _$stateProvider_;
  }));
  beforeEach(inject(function(_$state_, _$rootScope_) {
    $state = _$state_;
    $rootScope = _$rootScope_;
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

      $state.go('derived');
      $rootScope.$digest();

      expect($state.current.data.$subs).toEqual(['sub1', 'sub2', 'sub3', 'sub4']);

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

      $state.go('derived');
      $rootScope.$digest();

      expect($state.current.data.$subs).toEqual(['sub1', 'sub2']);

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

      $state.go('sib1');
      $rootScope.$digest();
      expect($state.current.data.$subs).toEqual(['base1', 'base2', 'branch1_1', 'branch1_2', 'branch1_sib1_1', 'branch1_sib1_2']);

      $state.go('sib2');
      $rootScope.$digest();

      expect($state.current.data.$subs).toEqual(['base1', 'base2', 'branch1_1', 'branch1_2', 'branch1_sib2_1', 'branch1_sib2_2']);

      $state.go('uncle');
      $rootScope.$digest();

      expect($state.current.data.$subs).toEqual(['base1', 'base2', 'uncle']);

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

      $state.go('a');
      $rootScope.$digest();

      expect($state.current.resolve.$__subs).toEqual(jasmine.any(Array));

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

      $state.go('a');
      $rootScope.$digest();

      expect(arrDep).toEqual(['dep1', 'dep2', '$__subs', arrDepFn]);
      expect(fnDep.$inject).toEqual(['dep1', 'dep2', '$__subs']);

    });

  });

});
