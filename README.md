# nobin-debian-installer

Create .deb packages from linux, windows, OSX with no binary dependencies.
its a grunt stripped version of [sebestindragos/grunt-contrib-deb](https://github.com/sebestindragos/grunt-contrib-deb)

## Getting started

Installation:

```shell
npm install nobin-debian-installer --save-dev
```

Once installed, it may be executed with this line of JavaScript:

### Usage

```js

var deb = require('nobin-debian-installer')()

var definition = {
  package: require('./package.json'), // needed for extracting project info
  info: {
    rev: '512', // optional revision number
    arch: 'amd64', // optional architecture type
    targetDir: './dist', // optional folder where to build the .deb package
    scripts: {
      preinst: './deb/scripts/preinst', // optional pre install script
      postinst: './deb/scripts/postinst', // optional post install script
      prerem: './deb/scripts/prerem', // optional pre remove script
      postrem: './deb/scripts/postrem', // optional post remove script
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
