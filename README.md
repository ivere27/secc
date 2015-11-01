# secc - Distributed compiler with morden web technology.

a project of 'Second Compiler'.

## Key Features

- RESTful API in Daemon/Scheduler
- Preprocessed and Pump Mode
- Memory Cache(works like remote CCache)
- Debug fission(-gsplit-dwarf option) supports.
- Monitoring by Browser(WebSocket)
- Cross-compile(Various version/machine of compiler in network) supports

## How to use

install by git clone (or npm)

### Client

set PATH and NUMBER_OF_PROCESSORS(-jX)

     export PATH=/path/to/secc/bin:$PATH
     export NUMBER_OF_PROCESSORS="8"

set SECC_MODE = 1 or 2 (see below, Mode section)

     export SECC_MODE=1

set SECC_CACHE if you want to use remote daemon's cache.

     export SECC_CACHE=1

edit "client" part in 'settings.json' file.
set schduler's address and port.

upload your compiler archive by ./tool/secc-create-archive.js

     nodejs secc-create-archive.js /usr/bin/gcc /usr/bin/g++ ./icecc-create-env.in http://SCHEDULER:10509

then, just use gcc as normal.

     gcc -c test.c

### Daemon

edit "daemon" part in 'settings.json' file.
set scheduler's address and port.

if you want to use cache, go #Caches secction.

      chmod a+w run
      chmod a+w uploads

run 'nodejs secc-daemon.js' as root for chroot-jail.
      sudo DEBUG=secc* nodejs secc-daemon.js

### Scheduler

      sudo DEBUG=secc* nodejs secc-scheduler.js

## Modes

MODE 1 - Preprocessed Mode(default)
  send one preprocessed source to daemon. (cause CPU load)

MODE 2 - Pump Mode
  send headers and source to daemon. (cause Memory/Bandwidth load)

MODE 3 - Git Mode(not yet supported.)

## Debug

use DEBUG=* to watch every vervose logs.
use DEBUG=secc* to watch only SECC's log.

      DEBUG=* gcc -c test.c

## Caches

install REDIS in a daemon computer. then,
enable "cache" in "daemon" part of 'settings.json' file.


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