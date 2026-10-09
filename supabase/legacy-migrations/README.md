# Legacy migration archive

This directory is a byte-for-byte archive of the migration files that existed
before the Phase 4 rollout hardening migration was added. The files under
`supabase/migrations/` remain the source of truth for an already-tracked
database; this archive is for audit, rollback planning, and reproducibility.

Do not edit, reorder, or execute this archive as an upgrade. Verify that an
archive copy matches its source before using it for an investigation:

```powershell
Get-FileHash supabase/migrations/<file>.sql
Get-FileHash supabase/legacy-migrations/<file>.sql
```

The archive contains no credentials and no production data.
