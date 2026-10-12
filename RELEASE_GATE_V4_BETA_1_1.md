# V4 Beta 1.1 — Production database release gate (12 October 2026)

## Confirmed read-only production checks
- public.ggc_state: id text, payload jsonb, updated_at timestamptz.
- One main row, updated 2026-10-12 12:52:22.85 UTC, payload approximately 441 KB.
- RLS enabled on public.ggc_state and public.profiles.
- ggc_state_authenticated_read: authenticated SELECT, qual true.
- ggc_state_authenticated_write: authenticated ALL, qual true, with_check true.
- profiles policies restrict read/insert/update to auth.uid() = id.
- public.ggc_records absent.
- ggc_state_migration_backups and ggc_identity_merge_backups exist, but restore integrity has not been verified.

## Release blockers
1. Existing authenticated ALL policy on ggc_state permits shared-blob writes by any signed-in user. Do not remove or replace until the app's permission-safe write path is designed and tested; changing it prematurely can break the live app.
2. Confirm an independent recoverable backup and test a restore.
3. Create and test ggc_records schema, ggc_save_record RPC, grants and RLS in isolated environment before applying to production.
4. Ensure data migration preserves all IDs and references; verify counts and integrity.
5. Complete two-device scorecard, permission, identity merge, WL handicap and Better Ball regression.
6. Recheck the protected-local-record warning and concurrent-save behaviour.
7. Deploy production only after automated tests, migration and rollback gates pass.

## Deployment discipline
- Do not trigger a Vercel deployment for each code or documentation change.
- V4 Beta 1.1 label is staged, not live.
- PR #55 remains draft until release gates pass.
