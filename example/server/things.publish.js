'use strict'

Meteor.publish("things", function() {
  return Things.find();
});
