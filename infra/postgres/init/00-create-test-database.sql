-- Dibuat sekali saat volume PostgreSQL masih kosong (docker-entrypoint-initdb.d).
-- todo_test dipakai oleh integration test supaya migration/truncate tidak
-- menyentuh database development.
CREATE DATABASE todo_test OWNER root;
