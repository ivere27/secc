# LLVM & CLANG
```bash
$ git clone https://github.com/llvm-mirror/llvm.git
$ git clone https://github.com/llvm-mirror/clang.git llvm/tools/clang
$ cd llvm && mkdir build && cd build
$ (#optional DEBUG=* SECC_LOG=/tmp/secc.log SECC_CMDLINE=1 \)
  SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ cmake ..

$ (#optinal DEBUG=* SECC_LOG=/tmp/secc.log SECC_CMDLINE=1 \)
  SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ make -j16
```

* http://llvm.org/docs/GettingStarted.html
* $ git clone http://llvm.org/git/llvm.git
* $ git clone http://llvm.org/git/clang.git llvm/tools/clang
