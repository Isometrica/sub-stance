
module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    ngAnnotate: {
      options: {
        singleQuotes: true,
      },
      subStance: {
        files: [
          {
            expand: true,
            src: ['src/**/*.ng.js'],
            ext: '.js',
            extDot: 'last'
          },
        ],
      }
    },
    concat: {
      options: {
        banner: '/* commonjs package manager support (eg componentjs) */\n' +
                'if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){\n' +
                '  module.exports = \'isa.substance\';\n' +
                '}\n\n' +
                '\'use strict\';' +
                '(function (window, angular, undefined) {\n',
        footer: '})(window, window.angular);'
      },
      dist: {
        src: ['src/**/*.js'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mmm-dd") %> */\n'
      },
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    },
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
      options: {
        globals: {
          angular: true
        }
      }
    },
    karma: {
      once: {
        singleRun: true,
        configFile: 'karma.conf.js'
      },
      unit: {
        singleRun: false,
        configFile: 'karma.conf.js'
      }
    },
    watch: {
      files: ['src/**/*.js', 'test/**/*.js'],
      tasks: ['jshint', 'karma:unit']
    }
  });

  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-ng-annotate');

  grunt.registerTask('default', ['jshint', 'karma:once', 'concat', 'uglify']);
  grunt.registerTask('test', ['karma:unit']);

};
