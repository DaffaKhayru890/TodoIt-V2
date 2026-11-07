# Pengelolaan antrean

Perintah:

```bash
bun run notifications:inspect-job -- <jobId>
bun run notifications:retry-failed -- <jobId>
bun run notifications:reconcile
bun run notifications:cleanup -- --dry-run
```

Inspect tidak mencetak payload. Retry hanya untuk status failed. Cleanup tidak menyentuh pending atau processing.
