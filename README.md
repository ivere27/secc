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

## How to use

install by git clone (then npm install)

```sh
git clone https://github.com/ivere27/secc.git
cd secc
npm install
```

make sure you've already installed nodejs.


### Client

set PATH and NUMBER_OF_PROCESSORS(-jX)

```sh
export PATH=/path/to/secc/bin:$PATH
export NUMBER_OF_PROCESSORS="8"
```

set SECC_MODE = 1 or 2 (see below, Mode section)

```sh
export SECC_MODE=1
```

set SECC_CACHE if you want to use remote daemon's cache.

```sh
export SECC_CACHE=1
```

edit "client" part in 'settings.json' file.
set scheduler's address and port.

upload your compiler archive by ./tool/secc-upload-archive.js

gcc

```sh
nodejs secc-upload-archive.js --gcc /path/to/gcc /path/to/g++ archivetool.js http://SCHEDULER:PORT
```

clang

```sh
nodejs secc-upload-archive.js --clang /path/to/clang /path/to/clang++ archivetool.js http://SCHEDULER:PORT
```

in linux case(you can use the specific compiler version),

     nodejs secc-upload-archive.js --gcc /usr/bin/gcc-5 /usr/bin/g++-5 ./secc-create-archive-linux.js http://172.17.42.1:10509

     nodejs secc-upload-archive.js --clang /usr/bin/clang /usr/bin/clang++ ./secc-create-archive-linux.js http://172.17.42.1:10509

then, just use gcc as normal.

```sh
gcc -c test.c
```

### Daemon

edit "daemon" part in 'settings.json' file.
set scheduler's address and port.

if you want to use cache, go #Caches section.

```sh
chmod a+w run
chmod a+w uploads
```

run 'nodejs secc-daemon.js' as root for chroot-jail.

```sh
sudo DEBUG=secc* nodejs secc-daemon.js
```

### Scheduler

```sh
sudo DEBUG=secc* nodejs secc-scheduler.js
```

## Modes

MODE 1 - Preprocessed Mode(default)
  send one preprocessed source to daemon. (cause CPU load)

MODE 2 - Pump Mode
  send headers and source to daemon. (cause Memory/Bandwidth load)

MODE 3 - Git Mode(not yet supported.)

## Debug

use DEBUG=* to watch every verbose logs.
use DEBUG=secc* to watch only SECC's log.

```sh
DEBUG=* SECC_MODE=1 SECC_CACHE=1 /path/to/secc/bin/gcc -c test.c
```

## Caches

install REDIS in a daemon computer. then,
enable "cache" in "daemon" part of 'settings.json' file.

## Scheduler's API

Verb | Endpoint | Note
--- | --- | ---
`GET` | / | Scheduler Monitor(HTML/JS)
`GET` | /archive | uploaded archive list
`GET` | /archive/{archiveId} | archive information of {archiveId}
`GET` | /archive/{archiveId}/file | download the compiler archive file
`DELETE` | /archive/{archiveId} | remove {archiveId} archive
`POST` | /archive | upload a new archive(used by tool/secc-upload-archive.js)
`GET` | /cache | cache metadata list
`DELETE` | /cache | clear all caches in Scheduler & Daemons
`GET` | /daemon | connected daemon list
`GET` | /job | working job list
`GET` | /job/new | request new job(used by secc.js client)

## Daemon's API

Verb | Endpoint | Note
--- | --- | ---
`GET` | /native/system | daemon's native compiler(installed)
`POST` | /compile/preprocessed/native | compile a preprocessed source by daemon's native compiler
`POST` | /compile/preprocessed/{archiveId} | compile a preprocessed source by {archiveId}(the archive is downloaded from Scheduler)
`POST` | /compile/pump/{archiveId}/{projectId}/filecheck | check dependency files whether already uploaded or not.
`POST` | /compile/pump/{archiveId}/{projectId} | compile a source with dependencies by {archiveId}(the archive is downloaded from Scheduler)
`GET` | /cache/{sourceHash}/{argvHash} | response the stored cache


# License

The MIT License (MIT)
Copyright (c) 2015 ivere27

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.