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


