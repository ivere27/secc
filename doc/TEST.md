|                    | gcc     | clang   |
| :-------------     | :------ | :------ |
| llvm               | tested  | tested  |
| clang              | tested  | tested  |
| node.js            | tested  | tested  |
| webkit - gtk libs  | tested  | tested  |
| webkit - efl libs  | tested  | tested  |


# LLVM
```bash
$ git clone http://llvm.org/git/llvm.git
$ cd llvm && mkdir build && cd build
$ SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ cmake ..

$ (#optional DEBUG=* SECC_LOG=/tmp/secc.log SECC_CMDLINE=1 \)
  SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ make -j16
```

* http://llvm.org/docs/GettingStarted.html
* use ld.gold if possible. https://trac.webkit.org/wiki/WebKitGTK/SpeedUpBuild#gold


# CLANG
```bash
$ git clone http://llvm.org/git/clang.git llvm/tools/clang
$ #build - same as llvm
```

# node.js (libuv + v8)
```bash
$ git clone https://github.com/nodejs/node
$ cd node
$ SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ ./configure
$ (#optional DEBUG=* SECC_LOG=/tmp/secc.log SECC_CMDLINE=1 \)
  SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ make -j16
```


# webkit - update-webkitgtk-libs
```bash
$ git clone git://git.webkit.org/WebKit.git
$ cd WebKit/Tools/Scripts
$ (#optional DEBUG=* SECC_LOG=/tmp/secc.log SECC_CMDLINE=1 \)
  NUMBER_OF_PROCESSORS=16 SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ ./update-webkitgtk-libs
```

* this includes
cairo, fontconfig, freetype6, harfbuzz, libxml2, gtk+, glib, icu, libsoup, atk, gstreamer, gst-libav, openwebrtc, llvm, xserver, mesa


# webkit - update-webkitefl-libs
```bash
$ git clone git://git.webkit.org/WebKit.git
$ cd WebKit/Tools/Scripts
$ (#optional DEBUG=* SECC_LOG=/tmp/secc.log SECC_CMDLINE=1 \)
  NUMBER_OF_PROCESSORS=16 SECC_ADDRESS=192.168.10.6 SECC_CACHE=1 SECC_CROSS=0 CC=~/open/secc/bin/clang CXX=~/open/secc/bin/clang++ ./update-webkitefl-libs
```

* this includes
cairo, fonts, fontconfig, freetype6, harfbuzz, glib, libsoup, elementary, libxml2, libnice, gstreamer, gst-libav, atk, openwebrtc
