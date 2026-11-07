# Respons insiden keamanan

Jika secret bocor: hentikan pemakaian secret itu, ganti lewat platform, pindahkan JWT lama ke previous hanya selama masa transisi yang pendek, cabut session bila refresh token ikut terekspos, dan catat waktu serta cakupan. Jangan menulis secret baru ke repository.

Jika diduga akses lintas workspace: cabut session aktor, periksa audit log, dan jangan menghapus baris audit.
