var tar = require('tar-stream')
var fs = require('fs')
var path = require('path')
var async = require('async')
var ar = require('ar-async')
var crypto = require('crypto')
var zlib = require('zlib')
var debug = require('debug')('nobin-debian-installer')

/**
 * Class used for creating .deb packages
 */
function Deb () {
  this.data = tar.pack()
  this.control = tar.pack()
  this.pkgSize = 0
  this.controlFile = {}
  this.filesMd5 = []
  this.dirs = {}
}

Deb.prototype.pack = function (definition, files, callback) {
  var self = this

  async.series([
    packFiles.bind(this, expandFiles(files)),
    buildControlFile.bind(this, definition),
    function buildDebBinFile (done) {
      fs.writeFile('./debian-binary', '2.0\n', done)
    },
    function buildPackage (done) {
      var pkgName = definition.info.targetName ||
        './' + self.controlFile.Package + '_' + self.controlFile.Version +
        '_' + self.controlFile.Architecture + '.deb'

      var pkgPath = path.resolve(path.join(definition.info.targetDir || '', pkgName))

      debug('creating %s package', pkgPath)
      var writer = new ar.ArWriter(pkgPath, {variant: 'gnu'})
      writer.writeEntries([
        './debian-binary',
        './control.tar.gz',
        './data.tar.gz'
      ], function (err) {
        if (err) debug('failed to write .deb file')

        // remove temp files
        async.parallel([
          fs.unlink.bind(fs, './control.tar.gz'),
          fs.unlink.bind(fs, './data.tar.gz'),
          fs.unlink.bind(fs, './debian-binary')
        ], done)
      })
    }
  ], callback)
}

/**
 * Build the control part of the .deb package.
 */
function buildControlFile (definition, callback) {
  var self = this

  self.controlFile = {
    Package: definition.info.name || definition.package.name,
    Version: definition.package.version + '-' + (definition.info.rev || '1'),
    'Installed-Size': self.pkgSize,
    Section: 'misc',
    Priority: 'optional',
    Architecture: definition.info.arch || 'all',
    Depends: '',
    Maintainer: (definition.package.author ? (definition.package.author.name + ' <' + definition.package.author.email + '>') : ''),
    Description: definition.package.description
  }

  // create the control file
  async.parallel([
    function createControlFile (prlDone) {
      var controlHeader = ''
      async.forEachOf(self.controlFile, function (value, key, done) {
        controlHeader += key + ': ' + value + '\n'
        done()
      }, function (err) {
        if (err) {
          debug('could not write control file')
          return prlDone(err)
        }

        self.control.entry({name: './control'}, controlHeader, prlDone)
      })
    }, function createHashFile (prlDone) {
      var fileContent = ''
      for (var i = 0; i < self.filesMd5.length; i++) {
        fileContent += self.filesMd5[i].md5 + '  ' + self.filesMd5[i].path.replace(/^\W*/, '') + '\n'
      }
      self.control.entry({name: './md5sums'}, fileContent, prlDone)
    }, function addScripts (prlDone) {
      async.forEachOf(definition.info.scripts, function (path, scriptName, doneScript) {
        debug('processing script ', path)
        async.waterfall([
          fs.access.bind(fs, path, fs.F_OK),
          fs.stat.bind(fs, path),
          function readFile (stats, wtfDone) {
            fs.readFile(path, function (err, data) {
              wtfDone(err, stats, data)
            })
          },
          function addScript (stats, data, wtfDone) {
            debug('adding script ', scriptName)
            self.control.entry({
              name: './' + scriptName,
              size: stats.size,
              mode: 0755
            }, data, wtfDone)
          }
        ], doneScript)
      }, prlDone)
    }
  ], function (err) {
    if (err) {
      debug('could not write control tarball')
      return callback(err)
    }

    debug('successfully created control file')

    self.control.finalize()

    var file = fs.createWriteStream(path.resolve('./' + 'control.tar.gz'))
    file.on('finish', callback)

    var compress = zlib.createGzip()
    compress.pipe(file)
    self.control.pipe(compress)
  })
}

/**
 * Add files to the .deb package.
 *
 * @param files - an object with the following format {'path/to/source/dir': 'path/to/target/dir'} (e.g. {'../../src/lib': '/srv/productName/lib'})
 */
function packFiles (files, callback) {
  var self = this

  async.eachSeries(files, function (crtFile, done) {
    var filePath = path.resolve(crtFile.src[0])
    debug('adding %s', filePath)
    async.waterfall([
      fs.stat.bind(fs, filePath),
      function (stats, wtfDone) {
        if (stats.isDirectory()) {
          addParentDirs(self.data, crtFile.dest, self.dirs, done)
        } else {
          async.waterfall([
            fs.readFile.bind(fs, filePath),
            function writeFileToTarball (data, wtf2Done) {
              self.data.entry({
                name: '.' + crtFile.dest,
                size: stats.size
              }, data, function (err) {
                wtf2Done(err, data)
              })
            },

            function processFile (fileData, wtf2Done) {
              self.pkgSize += stats.size

              self.filesMd5.push({
                path: crtFile.dest,
                md5: crypto.createHash('md5').update(fileData).digest('hex')
              })

              wtf2Done()
            }
          ], wtfDone)
        }
      }
    ], done)
  }, function (err) {
    if (err) {
      debug('there was a problem adding files to the .deb package: ', err)
      callback(err)
    } else {
      debug('successfully added files to .deb package')

      var file = fs.createWriteStream(path.resolve('./' + 'data.tar.gz'))
      file.on('finish', callback)

      var compress = zlib.createGzip()
      compress.pipe(file)

      self.data.pipe(compress)
      self.data.finalize()
    }
  })
}

function addParentDirs (tarball, dir, createdDirs, callback) {
  if (dir !== '/') {
    addParentDirs(tarball, path.dirname(dir), createdDirs, function (err) {
      if (err) return callback(err)

      addDir()
    })
  } else {
    addDir()
  }

  function addDir () {
    if (!createdDirs[dir]) {
      createdDirs[dir] = 1
      tarball.entry({name: '.' + dir, type: 'directory'}, callback)
    } else {
      callback()
    }
  }
}

function expandFiles (files) {
  var expand = require('glob-expand')
  var expandedFiles = []
  files.map(function (file) {
    var sources = expand(file, file.src)
    sources.map(function (source) {
      expandedFiles.push({
        src: [path.join((file.cwd ? file.cwd : ''), source)],
        dest: path.join(file.dest, source)
      })
    })
  })
  return expandedFiles
}

module.exports = function () {
  return new Deb()
}
