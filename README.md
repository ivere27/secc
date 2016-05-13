# secc - Distributed compiler with modern web technology.

a project of 'Second Compiler'.

## Key Features

- RESTful API in Daemon/Scheduler
- Preprocessed and Pump Mode
- Memory Cache(works like remote Ccache)
- Debug fission(-gsplit-dwarf option) supports.
- Monitoring by Browser(WebSocket)
- Cross-compile(Various version/machine of compiler in network) supports
- Gcc / Clang support

## Quick Start
  - [use DOCKER to start a scheduler and daemons](https://github.com/ivere27/secc/blob/master/doc/DOCKER.md)

## How to use

install by git clone (then npm install)

```sh
git clone https://github.com/ivere27/secc.git
cd secc
npm install
```

make sure you've already installed node.js, npm and (optionally) redis
* Ubuntu $ sudo apt-get install nodejs npm nodejs-legacy redis-server
* Mac $ brew install nodejs redis


### Client - your PC

set PATH and NUMBER_OF_PROCESSORS(-jX)
> edit "client" part in 'settings.json' file.
> set scheduler's address and port.
```sh
$ export PATH=/path/to/secc/bin:$PATH
$ export NUMBER_OF_PROCESSORS="8"
$ # then,
$ clang -c test.c
```
```

or just use CC, CXX and NUMBER_OF_PROCESSORS env
```sh
$ SECC_ADDRESS=172.17.42.1 SECC_CACHE=1 SECC_CROSS=0 \
CC=/path/to/secc/bin/clang CXX=/path/to/secc/bin/clang++ ./configure
$ SECC_ADDRESS=172.17.42.1 SECC_CACHE=1 SECC_CROSS=0 \
CC=/path/to/secc/bin/clang CXX=/path/to/secc/bin/clang++ make -j8
```

upload your compiler archive by ./tool/secc-upload-archive.js

```sh
$ # for clang
$ node secc-upload-archive.js --clang /path/to/clang /path/to/clang++ archivetool.js http://SCHEDULER:PORT
$ # for gcc
$ node secc-upload-archive.js --gcc /path/to/gcc /path/to/g++ archivetool.js http://SCHEDULER:PORT
```

in linux case(you can use the specific compiler version),

     node secc-upload-archive.js --gcc /usr/bin/gcc-5 /usr/bin/g++-5 ./secc-create-archive-linux.js http://172.17.42.1:10509

     node secc-upload-archive.js --clang /usr/bin/clang /usr/bin/clang++ ./secc-create-archive-linux.js http://172.17.42.1:10509


#### Alternatives
* (experimental) [secc-shell](http://github.com/ivere27/secc-shell) - bash shell frontend
* (experimental) [secc-native](http://github.com/ivere27/secc-native) - native(c++) frontend

### Daemon - n PC

edit "daemon" part in 'settings.json' file.
set scheduler's address and port.

if you want to use cache, go #Caches section.

run 'node secc-daemon.js' as root for chroot-jail.

```sh
$ sudo DEBUG=secc* node secc-daemon.js
```

### Scheduler - 1 PC

```sh
$ DEBUG=secc* node secc-scheduler.js
```

## Modes

MODE 1 - Preprocessed Mode(default)
  send one preprocessed source to daemon. (cause CPU load)

MODE 2 - Pump Mode
  send headers and source to daemon. (cause Memory/Bandwidth load)

MODE 3 - Git Mode(not yet supported.)

## Debug

- DEBUG=* to watch every verbose logs.
- DEBUG=secc* to watch only SECC's log.
- SECC_LOG=/path/to/log.txt - redirect logs to a file

```sh
$ DEBUG=* SECC_MODE=1 SECC_CACHE=1 /path/to/secc/bin/gcc -c test.c
```

## Caches

install REDIS in a daemon computer. then,
enable "cache" in "daemon" part of 'settings.json' file.

## Environment Variable

| ENV                 | secc-client            | secc-daemon        | secc-scheduler |
| :-------------      | :---------------:      | :----------------: | :------------: |
| SECC_ADDRESS        | scheduler address      | scheduler address  | -              |
| SECC_PORT           | scheduler port         | scheduler port     | listening port |
| DEBUG               | log level              | log level          | log level      |
| SECC_LOG            | log file path          | log file path      | log file path  |
| SECC_CMDLINE        | log command line       | -                  | -              |
| SECC_MODE           | processed or pump      | -                  | -              |
| SECC_CACHE          | cache prefer           | cache enable       | -              |
| SECC_CROSS          | cross-compiling prefer | -                  | -              |
| SECC_CC             | c compiler path        | -                  | -              |
| SECC_CXX            | c++ compiler path      | -                  | -              |
| REDIS_ADDRESS       | -                      | redis address      | -              |
| REDIS_PORT          | -                      | redis port         | -              |
| SECC_EXPOSE_ADDRESS | -                      | address for client | -              |
| SECC_EXPOSE_PORT    | -                      | port for client    | -              |


## How It Works
* Scheduler - RESTful/WebSocket/Monitoring WebServer
* Daemon - RESTful WebServer + WebSocket Client + Cache Server(redis)
* Client - http client

- (once) Client uploads a Compiler Archive to Scheduler
- Scheduler and Daemons are connected by WebSocket
- Client asks to Scheduler which daemon is available by REST API
- (Optional) Client tries to get caches if possible
- Client sends a source or/and dependencies to a Daemon by REST API
- (once) Daemon downloads the archive from Scheduler if not exists
- Daemon compiles the sources by Client's Compiler Archive
- Daemon responds to Client with a object(+@)
- (Optional) Objects are stored in Daemon's MemoryDB(redis)

# License

MIT
