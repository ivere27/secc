# Worker

> PC1 - linux
* CPU : 4(2x2) - Intel(R) Core(TM) i3-4330 CPU @ 3.50GHz
* OS : ubuntu-15.10-desktop-amd64

> PC2 - linux
* CPU : 8(4x2) - Intel(R) Xeon(R) CPU E3-1230 V2 @ 3.30GHz
* OS : ubuntu-15.10-server-amd64 on XenServer 6.5

> PC3 - mac
* CPU : 4(2x2) - Intel(R) Core(TM) i5-5257U CPU @ 2.70GHz
* OS : OS X El Capitan 10.11.3

## Test code
> webkit <br>
> $ git checkout \`git rev-list -n 1 --before="2016-01-01 00:00:00" master\`


### pc1 - direct compile
> gcc 5.2.1 <br>
> $ CC=/usr/bin/gcc CXX=/usr/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (13m:17s).
* JavaScriptCore is now built (13m:24s).
* JavaScriptCore is now built (13m:24s).
* JavaScriptCore is now built (13m:28s).
* JavaScriptCore is now built (13m:22s).


### pc2 - direct compile.
> gcc 5.2.1 <br>
> $ CC=/usr/bin/gcc CXX=/usr/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (09m:25s).
* JavaScriptCore is now built (09m:25s).
* JavaScriptCore is now built (09m:21s).
* JavaScriptCore is now built (09m:25s).
* JavaScriptCore is now built (09m:27s).

> clang 3.6.2-1 <br>
> $ CC=/usr/bin/clang CXX=/usr/bin/clang++ ./build-jsc --gtk --release
*  JavaScriptCore is now built (07m:12s).
*  JavaScriptCore is now built (07m:12s).
*  JavaScriptCore is now built (07m:11s).
*  JavaScriptCore is now built (07m:12s).
*  JavaScriptCore is now built (07m:12s).


### GCC - pc1(client) + pc2(daemon) without Cache
#### secc-node
> $ NUMBER_OF_PROCESSORS=16 SECC_ADDRESS=172.17.42.1 SECC_CACHE=0 \ <br>
> CC=/path/to/secc/bin/gcc CXX=/path/to/secc/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (07m:55s).
* JavaScriptCore is now built (07m:51s).
* JavaScriptCore is now built (07m:54s).

#### secc-shell
> $ NUMBER_OF_PROCESSORS=16 SECC_ADDRESS=172.17.42.1 SECC_CACHE=0 \ <br>
> CC=/path/to/secc-shell/bin/gcc CXX=/path/to/secc-shell/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (07m:34s).
* JavaScriptCore is now built (07m:35s).
* JavaScriptCore is now built (07m:29s).

#### secc-native
> $ NUMBER_OF_PROCESSORS=16 SECC_ADDRESS=172.17.42.1 SECC_CACHE=0 \ <br>
> CC=/path/to/secc-native/bin/gcc CXX=/path/to/secc-native/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (07m:22s).
* JavaScriptCore is now built (07m:19s).
* JavaScriptCore is now built (07m:21s).

### GCC - pc1(client) + pc2(daemon) with Cache
#### secc-node
> $ NUMBER_OF_PROCESSORS=8 SECC_ADDRESS=172.17.42.1 SECC_CACHE=1 \ <br>
> CC=/path/to/secc/bin/gcc CXX=/path/to/secc/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (02m:47s).
* JavaScriptCore is now built (02m:47s).
* JavaScriptCore is now built (02m:46s).

#### secc-shell
> $ NUMBER_OF_PROCESSORS=8 SECC_ADDRESS=172.17.42.1 SECC_CACHE=1 \ <br>
> CC=/path/to/secc-shell/bin/gcc CXX=/path/to/secc-shell/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (02m:02s).
* JavaScriptCore is now built (02m:01s).
* JavaScriptCore is now built (02m:01s).

#### secc-native
> $ NUMBER_OF_PROCESSORS=8 SECC_ADDRESS=172.17.42.1 SECC_CACHE=1 \ <br>
> CC=/path/to/secc-native/bin/gcc CXX=/path/to/secc-native/bin/g++ ./build-jsc --gtk --release
* JavaScriptCore is now built (01m:52s).
* JavaScriptCore is now built (01m:52s).
* JavaScriptCore is now built (01m:52s).



# Hacks
> Linux tmpfs
```bash
$ sudo rm -rf /path/to/secc/run/*
$ sudo rm -rf /path/to/secc/uploads/*
$ sudo mount tmpfs /path/to/secc/run -t tmpfs
$ sudo mount tmpfs /path/to/secc/uploads -t tmpfs -o noexec
```
