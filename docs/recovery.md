# Backup and recovery procedure

Production recovery is **not verified**. A local PGlite backup/restore rehearsal passed, but it is not a Supabase backup or a PG17 restore. No production backup was downloaded and no live restore/reset was attempted.

## Rehearsal completed locally

`tests/database/recovery.test.mjs` builds all migrations in an isolated PGlite engine with stub Auth, imports a synthetic draft, exports its data directory, closes the original engine, and restores into a fresh engine. It verifies ordered authors, a bigint archive ID, audit counts, unpublished isolation, denied private import/cleanup access and idempotent retry of the completed import. No test data enters application or hosted data.

PGlite's archive is compatible with PGlite, not a substitute for `pg_dump` or a Supabase managed backup. Docker, native PostgreSQL backup/restore tools, an authenticated CLI and an isolated Supabase restore target were unavailable. Real Auth sessions/users, managed extensions, cron, network policies and production PostgreSQL recovery remain untested. See [PGlite API](https://pglite.dev/docs/api) and [Supabase restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Before an approved release

1. Name an owner for backups and restoration. Agree acceptable data-loss window (RPO), recovery duration (RTO), retention and storage location. Neither target is established by this local test.
2. Verify the Supabase plan's actual managed backup/PITR availability and latest successful recovery point in its dashboard. Record the timestamp and backup ID without secrets. Follow [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups); do not assume a free project has downloadable managed backups.
3. With authorization, create a protected logical backup using a trusted direct connection or the CLI. Include schema, data, needed roles, `public`, `private`, required Auth users and `supabase_migrations` history. Explicitly verify custom private schemas and migration history are present; default CLI exclusions and managed schema definitions require the official restore procedure. Include grants, RLS, functions, triggers, sequences and extension versions. Keep checksums and a manifest.
4. CLI command shapes, after linking the correct project, are `npx supabase db dump --linked --role-only --file <protected-roles.sql>`, `npx supabase db dump --linked --file <protected-schema.sql>`, and `npx supabase db dump --linked --data-only --use-copy --file <protected-data.sql>`. These were inspected with `--help`, **not run**. Use a protected directory outside Git/public assets; supply credentials through approved local tooling, never chat, command history, documentation or build variables. Review output contents against the required schema list before accepting the backup.
5. Store backup files encrypted with restricted access. Raw imports and private identifiers may be included and must remain private. Protect Auth signing/SMTP/provider settings separately using the team's secret store. Export nonsecret Auth URL settings, Netlify deploy ID/build configuration, cron schedule and migration manifest. Storage object bytes require a separate backup if that feature is introduced; database metadata alone is insufficient.

## Rehearse in a fresh isolated Supabase target

1. Obtain an explicitly authorized target that serves no public site and contains no real application data. Verify its project reference differs from the live project. Disable external email/webhook side effects; review extensions and compatible PostgreSQL versions.
2. Follow the official Supabase restore process for roles, application schema, managed Auth compatibility and data. Restore with foreign-key/trigger handling described by that procedure; fail on SQL errors and inspect logs. Do not apply a foundation migration over the restored schema or use `db reset` against the live project.
3. Restore/reconcile migration history and sequences. Verify table counts and relationships, archive IDs as strings, source timestamps, author order, sources, membership, grants/RLS, audit logs and committed import summaries. Confirm no browser access to actor columns, identifiers, raw import or audit/membership data.
4. With isolated test accounts, exercise real Auth login, refresh, logout and access revocation. Run synthetic lifecycle/import/retry/rollback tests. A completed restored batch must return the same stored summary without inserting anything. Verify unused drafts remain private.
5. Recreate trusted scheduled jobs only after reviewing the restored configuration. Confirm one cleanup job and successful execution on synthetic aged batches without losing audit/idempotency information. Do not enable outgoing integrations blindly.
6. Record backup checksum, restore start/end, errors, PostgreSQL/CLI versions, all validation results and achieved recovery time. Only a successful Supabase restore with these checks can close the production recovery gate. Restrict or securely retire the isolated copy according to the backup retention policy.

## Rollback after an authorized release

- Frontend: preserve the previous Netlify deploy ID before publishing. If a regression occurs, an authorized operator restores that known deploy and checks direct routes/Auth compatibility. This does not roll back the database. No deployment was triggered here.
- Database: prefer an additive forward repair that preserves data and closes security gaps. Do not reverse the access-hardening grant repair by reopening actor columns. A migration-history edit is not a schema rollback.
- If data restoration is necessary, obtain explicit approval, stop writes through an agreed maintenance procedure, take a current snapshot, restore the verified backup into a separate target, validate it, then perform a planned cutover. Account for writes since the backup and communicate the loss window. Never silently overwrite the live database with an old dump.

Completed import batch IDs, stored summary counts, row-to-thesis links and audit entries must survive recovery. Retention clears raw/normalized row payloads and mapping after 30 days, cancels unfinished batches and preserves committed retry information. Do not purge these retained identifiers to make a retry appear new.
