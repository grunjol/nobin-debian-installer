var test = require('tape')
var deb = require('../')()
var pkg = require('./deep-package.json')

test('basic.deep: create basic deep structure', function (t) {
  t.plan(2)
  deb.pack({
    package: pkg,
    info: {
      arch: 'amd64',
      targetDir: 'test/dist'
    }
  }, [{
    src: ['./**'],
    dest: '/opt/deep',
    expand: true,
    cwd: 'test/deep'
  }], function (err, done) {
    t.error(err, 'failed to create')
    t.pass('created Linux .deb file')
  })
})
