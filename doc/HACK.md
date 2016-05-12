# Hacks
> Linux tmpfs
```bash
$ mkdir /path/to/run/
$ mkdir /path/to/upload/
$ #sudo rm -rf /path/to/run/*
$ #sudo rm -rf /path/to/upload/*
$ sudo mount tmpfs /path/to/run -t tmpfs
$ sudo mount tmpfs /path/to/upload -t tmpfs -o noexec
```
> set "runPath", "uploadPath" in settings.json
> then, restart secc-daemon