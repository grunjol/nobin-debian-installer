# nobin-debian-installer

Create .deb packages from linux, windows, OSX with no binary dependencies.
its a grunt stripped version of [sebestindragos/grunt-contrib-deb](https://github.com/sebestindragos/grunt-contrib-deb)

## Getting started

Installation:

```shell
npm install nobin-debian-installer --save-dev
```

Once installed, it may be executed with:

### Usage

```js

var deb = require('nobin-debian-installer')()

var definition = {
  package: require('./package.json'), // needed for extracting project info
  info: {
    rev: '512', // optional revision number
    arch: 'amd64', // optional architecture type
    name: 'my-package', // optional package name
    depends: 'libc6 (>= 2.4)', // optional dependency list
    targetDir: './dist', // optional folder where to build the .deb package
    scripts: {
      preinst: './deb/scripts/preinst', // optional pre install script
      postinst: './deb/scripts/postinst', // optional post install script
      prerm: './deb/scripts/prerm', // optional pre remove script
      postrm: './deb/scripts/postrm', // optional post remove script
    }
  }
}

var files = [{
  src: ['src/**', '!tests/**'],
  dest: '/srv/myproject',
  cwd: './server',
  expand: true
}, { // add configuration files (init scripts, logrotate, systemd, etc...)
  src: ['**'],
  dest: '/etc',
  cwd: './config',
  expand: true
}]

function callback () {
  console.log('done!');
}

// magic
deb.pack(definition, files, callback)
```
## License

MIT
