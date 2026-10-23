# Migration reconciliation — 23 October 2026

Read-only inspection of the project backing `sipii.netlify.app` found these versions. The original migration files were not rewritten and remote history was not repaired.

| Local version | Remote history | Actual effects / disposition |
| --- | --- | --- |
| `20261022130506_schema_foundation` | Same | Foundation objects present; do not rerun. |
| `20261022130508_administrator_transactions` | Same | Protected lifecycle functions present, with subsequent source-scope changes. |
| `20261022135703_administrator_management` | Same | Administrator read/management objects present. |
| `20261022141725_preserve_archive_identifier_precision` | Same | Archive ID string projection present. |
| `20261022144334_public_discovery` | Absent | Search/detail RPCs present, but actor column grants are too broad and unused legacy `public_topics()` is absent. **Not fully applied; do not mark applied as-is.** |
| `20261022144427_transactional_imports` | Absent | Current import functions/column effects exist through the later repair. This does not prove the original file ran. Do not replay its CREATE statements over existing functions. |
| `20261023081324_release_access_hardening` | Absent | New prepared additive repair; not applied to live. |
| `20261023090000_compendium_content_scope` | Absent | Source-scope effects present: restricted content validation, optional classifications and preservation, source-only public projection, ordered relationships and private identifier protection. Manually applied, as reported by gerikah; current definitions compared with expected final schema. |
| `20261023090001_repair_import_installation` | Recorded as `20261023030535_repair_import_installation` | Function bodies, grants and repair columns match. Different history version, not missing installation. Preserve this evidence before deciding history alignment. |

The expected catalog was built from all original eight local migrations in disposable PGlite. All 16 application tables and their types/defaults/nullability, indexes, policies, triggers and constraints matched, apart from `theses.created_by/updated_by` read grants. PGlite/PG18 reports NOT NULL constraints differently from hosted PG17; column nullability was compared separately. Six shared function bodies differ only in whitespace. `private.admin_record_document` differs materially: live uses `to_jsonb(t)` and then removes actor keys, which still requires broad table read permission. Public RPC omission alone does not protect direct table reads. The platform event-trigger function `public.rls_auto_enable` is an additional hosted object.

## Prepared access repair

`20261023081324_release_access_hardening.sql` revokes table-wide SELECT from browser roles, restores explicit non-actor column grants, and uses an explicit administrator document projection. It also revokes browser execution of the platform event-trigger function if it exists. It changes no records, classifications or memberships. A local regression reproduces the live drift, applies the repair twice, checks approved reads, direct actor-column denial, and owner event-trigger execution.

This migration was generated with the installed CLI. Its timestamp sorts before the existing content-scope/repair files; it depends only on the already-present October 22 schema. A clean complete migration chain is tested. Do not renumber applied history to accommodate it.

## Safe history alignment procedure — not executed

1. Obtain production authorization, protected backup and restore evidence. Record the intended project reference and run `npx supabase migration list --linked` only after deliberately linking the correct project. Current CLI is not authenticated/linked locally.
2. Export existing migration history and actual definitions using trusted administration. `scripts/database-audit.sql` returns schema metadata only; `node scripts/export-schema-audit.mjs` builds expected metadata in a disposable engine. Keep operational exports outside Git.
3. Apply the new access repair alone after approval. Verify effective column privileges are false for both actor columns and both browser roles; a zero-row direct REST select must fail with permission denied. Verify public discovery and approved admin read/save behavior in an isolated staging copy before the approved live change.
4. Resolve the unused `public_topics()` difference explicitly: either supply its original safe invoker definition in a new compatibility migration and verify it, or approve a documented baseline exception. The UI never calls it. Do not claim the original discovery migration is fully installed while this discrepancy remains.
5. Agree on a historical baseline with the owner: original discovery/import effects are now superseded by repairs, content-scope was manual, and the repair has a different remote timestamp. `npx supabase migration repair --linked --status applied <verified-version>` changes history only, not objects; `--status reverted <old-version>` removes a history entry. Use these only for an explicitly reviewed mapping, preserving the old history export. Do not present unexecuted original files as having run; record why effects are represented by the reviewed baseline. No blanket repair command is supplied because discovery is still incomplete.
6. Compare history and objects again, then inspect `npx supabase db push --linked --dry-run`. It must not propose rerunning foundation, discovery CREATEs, original imports or the equivalent repair. Stop and resolve any unexpected proposal. Never rerun `sipi_schema.sql`.

`supabase/operations/inspect-release.sql` contains read-only follow-up sections for history, source, privileges, cron and aggregate retention status. Execute cron sections only after the extension exists. No remote migration, history, cron, Auth or data writes occurred during Phase 6.
