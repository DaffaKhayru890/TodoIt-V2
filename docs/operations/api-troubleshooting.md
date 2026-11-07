# Troubleshooting API

`/health` 200 dengan `/ready` 503 berarti proses hidup tetapi database tidak menjawab tepat waktu. Timeout statement dapat memutus query yang terlalu lama dengan error database, yang dipetakan ke respons aman tanpa SQL.

Request 413 berarti body melebihi batas. Request 429 berarti rate limit. Request 403 `ORIGIN_REJECTED` berarti Origin cookie tidak ada di allowlist.
