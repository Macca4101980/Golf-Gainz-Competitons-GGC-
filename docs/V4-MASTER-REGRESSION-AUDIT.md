# V4 Master Regression Audit — 2026-10-08

Legend: 🔵 newly added and automated CI passed; 🟢 previously passing automated checks; 🟠 pending real/live testing; 🔴 known incomplete or unsafe; ⚫ newly regressed (none established).

**Scope:** Automated GitHub CI on commit c2e34a654866321bb4ec96524f3209944bd04314: GGC Build Test SUCCESS; V4 PostgreSQL Integration SUCCESS. These statuses do not establish production readiness.

| Area | Status | Evidence / limitation |
|---|---|---|
| Build and unit test suite | 🟢 | GGC Build Test workflow passed |
| Synthetic local PostgreSQL schema/RPC and migration rehearsal | 🟢 | V4 PostgreSQL Integration workflow passed |
| 12 group-format 18-hole known-result totals | 🔵 | test/v4-group-format-oracle.test.js |
| Group leaderboard and front-nine known result | 🔵 | same test pack |
| Winter League lone teammate / different-day Better Ball | 🔵 | test/v4-winter-league-oracle.test.js |
| Winter League 46-point cut, both golfers, next-week carry | 🔵 | same test pack |
| Winter League cancelled week / countback / best 8 of 10 | 🔵 | same test pack |
| Scoped card API, optimistic revision conflict, two-device synthetic scenarios | 🟢 | existing v4 scorecard tests and integration suite |
| Production protected-backup read-only referential audit | 🟢 | docs/V4-REAL-BACKUP-READONLY-AUDIT.md |
| Actual protected-backup import/readback/rollback in isolated database | 🟠 | NOT DONE; required before cutover |
| Live-browser two-device concurrent edit / offline conflict UX | 🟠 | NOT VERIFIED; browser and authenticated sessions required |
| Winter League 25/26 and 26/27 actual season fixtures, scoring, money, handicaps | 🟠 | NOT VERIFIED with protected season data |
| All formats with handicap, partial cards, mixed tees, incomplete holes, tie-breaks | 🟠 | Not fully covered by synthetic group oracle |
| Full individual, pairs, matchplay, knockout, OOM and prize workflows | 🟠 | End-to-end coverage not established |
| Every score submission/edit path using secure scoped writes | 🔴 | Legacy paths remain; V4 scoped UI development-only |
| Conflict resolution and offline pending-sync user experience | 🔴 | Explicitly incomplete |
| Full cloud persistence of non-score management changes with V4 flag enabled | 🔴 | Disabled by design pending safe replacements |
| Production migration / feature-flag cutover | 🟠 | Intentionally on hold; no production writes |

## Release gate
Do **not** deploy or claim a full pass until all orange/ red rows are resolved, actual protected backup rehearsal verifies rollback, and live user flows have passed. Never expose production backup payload or personal data in CI.

## Queued next tests
- Expand individual and pairs known-answer scorecards; verify 90% Winter League allowance with nonzero handicaps and hole stroke indices.
- Exercise partial scorecards, missing partner, high/low handicap cuts, week date cascade and counting rules.
- Live authenticated two-device scenarios in an isolated environment.
- Protected real-backup migration rehearsal in local disposable PostgreSQL, using documented actual excluded group UUID.
- Matchplay league templates remain a separate design backlog; not part of this V4 release gate.
