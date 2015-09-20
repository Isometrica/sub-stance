
describe("$subStateMachine", function() {

  'use strict';
  var $subStateMachine = '';

  beforeEach(module('isa.substance'));
  beforeEach(inject(function(_$subStateMachine_) {
    $subStateMachine = _$subStateMachine_;
  }));

  describe("state", function() {

    it("should register simple subscription for state", function() {
      $subStateMachine.state('routeName', 'subName');
      expect($subStateMachine.get('routeName')).toBe({
        name: 'subName'
      });
    });

  });

});
