# Logging

Logger menulis satu JSON per baris dengan `timestamp`, `level`, `message`, dan field konteks. Composition root menambahkan `service` dan `environment`. Worker menambahkan `workerId`, dan runner menambahkan `jobId`, `jobType`, serta `attempt` pada peristiwa job.

Level mengikuti `LOG_LEVEL`. Field yang namanya memuat password, token, secret, cookie, jwt, credential, atau authorization diganti `[redacted]`. Nilai string yang memuat `Bearer` juga disamarkan.
