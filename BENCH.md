!! Worker
CPU : Intel(R) Xeon(R) CPU E3-1230 V2 @ 3.30GHz
OS : ubuntu-15.04-server-amd64 on XenServer 6.5
SOURCE : git checkout `git rev-list -n 1 --before="2016-01-01 00:00:00" master`

* direct compile.
$ ./build-jsc --gtk --release
1. JavaScriptCore is now built (09m:02s).
2. JavaScriptCore is now built (09m:04s).
3. JavaScriptCore is now built (09m:04s).
4. JavaScriptCore is now built (09m:03s).
5. JavaScriptCore is now built (09m:03s).


!! Hacks
* Linux tmpfs
$ sudo rm -rf /path/to/secc/run/*
$ sudo rm -rf /path/to/secc/uploads/*
$ sudo mount tmpfs /path/to/secc/run -t tmpfs
$ sudo mount tmpfs /path/to/secc/uploads -t tmpfs -o noexec