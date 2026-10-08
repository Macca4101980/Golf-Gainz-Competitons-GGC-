# V4 Release Gates — 2026-10-08

**Production deployment: BLOCKED.** No production mutation was performed.

## Gate 1 — real backup and isolated rollback
- PASS: read-only backup exists, backup ID 373f8a26-c527-4d7a-b8b6-2d61617ae609; 123 golfers, 12 groups, 36 competitions, 48 scorecards.
- PASS: explicit excluded test group Teat UUID 75eea654-ebc2-4e8a-8479-0acaa8a91c2d appears once; excluding it retains 11 groups, 35 competitions, 47 scorecards. No duplicate golfer IDs or card IDs.
- PASS: synthetic fixture isolated PostgreSQL import, readback and rollback in V4 Chained Regression run 37848710150.
- **BLOCKED:** importing this *real* protected backup into a separately isolated PostgreSQL instance and verifying full record readback + rollback has NOT been run. Do not copy real personal data to public GitHub/CI.

## Gate 2 — real multi-device scoring, invites, permissions
- PASS: automated two-golfer separate-card concurrent save and same-card stale-revision rejection; scoped PostgreSQL RPC permissions tested in isolated fixture.
- **BLOCKED:** two actual signed-in devices, real invitation acceptance, different-day Winter League card sync, admin delegated editing, offline/reconnect and user-visible conflict recovery have not been verified against an isolated live app.
- Keep V4 scoped scorecard UI feature flag OFF in production.

## Gate 3 — final production readiness
- PASS: chained unit tests, build, isolated PostgreSQL integration and synthetic rollback in run 37848710150.
- **BLOCKED:** Gate 1 real-backup import and Gate 2 live acceptance, controlled cutover, rollback rehearsal and user approval outstanding.
- Production remains unchanged; do not merge PR #51 or deploy migrations/feature flags.

## Safe next actions
1. Provision a disposable local PostgreSQL 16 instance (no paid Supabase branch) and securely materialize protected backup **outside CI**. Run scripts/v4-rehearse-import.mjs with the actual excluded group UUID and expected counts; require ROLLED_BACK and rollbackVerified.
2. Use a separate test environment with two authenticated accounts to verify invitation and scoped card saves; preserve baseline and audit logs.
3. Rerun chained CI, compare full normalized content/card JSON, document rollback and seek explicit production cutover approval.
