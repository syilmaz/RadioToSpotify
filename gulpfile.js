"use strict";

var gulp = require('gulp'),
    ts = require('gulp-typescript'),
    del = require('del'),
    _ = require('lodash'),
    sourcemaps = require('gulp-sourcemaps');


var tsProject = ts.createProject('tsconfig.json', {
    typescript: require('typescript')
});

var paths = {
    typescript: ['src/**/*.ts'],
    other: ['src/**/*.js', 'src/**/*.json']
};

gulp.task('clean', function(cb) {
    del('out').then(function() {
        cb();
    });
});

gulp.task('compile', function(cb) {
    var tsResult  = gulp.src(paths.typescript)
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    tsResult.js
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('out'));

    cb();
});

gulp.task('build', ['clean', 'compile'], function(cb) {
    gulp.src(paths.other)
        .pipe(gulp.dest('out'));

    cb();
});

gulp.task('default', ['build']);