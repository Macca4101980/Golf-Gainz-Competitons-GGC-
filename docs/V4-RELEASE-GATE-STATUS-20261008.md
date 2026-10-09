# V4 Release Gates — 2026-10-08

**Production deployment: BLOCKED.** No production mutation was performed.

## Gate 1 — real backup and isolated rollback
- PASS: read-only backup exists, backup ID 373f8a26-c527-4d7a-b8b6-2d61617ae609; 123 golfers, 12 groups, 36 competitions, 48 scorecards.
- PASS: explicit excluded test group Teat UUID 75eea654-ebc2-4e8a-8479-0acaa8a91c2d appears once; excluding it retains 11 groups, 35 competitions, 47 scorecards. No duplicate golfer IDs or card IDs.
- PASS: synthetic fixture isolated PostgreSQL import, readback and rollback in V4 Chained Regression run 37848710150.
- **PASS (user-run 2026-10-09):** real protected JSON backup was exported privately and rehearsed on isolated local Windows PostgreSQL 18 database `ggc_v4_test`. `scripts/v4-rehearse-import.mjs` reported `issues: []`, `transaction: ROLLED_BACK`, `rollbackVerified: true`, `verifiedNormalizedContents: true`, `verifiedScorecardContents: 47`, with counts 123 golfers, 11 groups, 80 memberships, 35 competition scopes and 47 scorecards. Evidence: user-provided local terminal screenshot; not independently rerun by CI. No backup payload committed or uploaded. Keep real personal data out of public GitHub/CI.

## Gate 2 — real multi-device scoring, invites, permissions
- PASS: automated two-golfer separate-card concurrent save and same-card stale-revision rejection; scoped PostgreSQL RPC permissions tested in isolated fixture.
- **BLOCKED:** two actual signed-in devices, real invitation acceptance, different-day Winter League card sync, admin delegated editing, offline/reconnect and user-visible conflict recovery have not been verified against an isolated live app.
- Keep V4 scoped scorecard UI feature flag OFF in production.

## Gate 3 — final production readiness
- PASS: chained unit tests, build, isolated PostgreSQL integration and synthetic rollback in run 37848710150.
- **BLOCKED:** Gate 2 live acceptance, controlled cutover (including production rollback procedure) and user approval outstanding. Gate 1 local real-backup rehearsal passed.
- Production remains unchanged; do not merge PR #51 or deploy migrations/feature flags.

## Safe next actions
1. Set up a separate non-production application and authentication environment with two signed-in accounts; verify invitation, independent scorecard saves, delegated edits, offline/reconnect and visible stale-write conflict recovery. Do not use production accounts or data without an approved secure plan.
2. Rerun chained CI and full scoring regression on the final candidate; preserve test evidence and audit trail.
3. Rehearse production cutover and restoration steps separately, document rollback, and obtain explicit user approval before any production mutation.
