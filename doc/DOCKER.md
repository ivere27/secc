### * Scheduler
```bash
$ sudo docker run --restart=always -p 10509:10509 --name secc_scheduler -d secc/scheduler
```

### * Daemon
replace SECC_ADDRESS and SECC_EXPOSE_ADDRESS with your IPs
```bash
$ sudo docker run --restart=always -p 6379:6379 --name secc_redis -d redis
$ sudo docker run --restart=always -p 10508:10508 --name secc_daemon \
--link secc_redis:secc_redis \
--env SECC_CACHE=1 --env REDIS_ADDRESS=secc_redis \
--env SECC_ADDRESS=192.168.0.2 \
--env SECC_EXPOSE_ADDRESS=192.168.0.3 --env SECC_EXPOSE_PORT=10508 -d secc/daemon
```
if scheduler and daemon are in the same host, use <br>
--link secc_scheduler:secc_scheduler --env SECC_ADDRESS=secc_scheduler

---
Dockfile - https://github.com/ivere27/secc-docker
