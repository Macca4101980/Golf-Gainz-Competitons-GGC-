# GGC V4 — Two-user acceptance and release gate (2026-10-09)

**Status: NOT YET RUN ON REAL SIGNED-IN DEVICES. Production blocked.**

## Prerequisites
- Use a disposable non-production app URL, isolated Supabase project/database and two distinct test Auth accounts. Never point a test preview at the production Supabase project.
- Apply the five V4 migrations and staged scoped scorecard RPC only to isolated database; set V4 scoped-scorecard feature flag only in isolated test app.
- Use fictional golfers, two devices/browsers, a test group and competition. Do not import protected real backup into hosted preview.
- Capture test account IDs, card IDs, revisions, expected vs observed UI, server row counts and pass/fail; redact credentials and tokens.

## Acceptance matrix
| ID | Action | Required result | Status |
|---|---|---|---|
| A1 | Account A creates a test group; invite B; B signs up and accepts | B appears exactly once as a member, no duplicate placeholder golfer; group role preserved | UNTESTED |
| A2 | A and B enter separate cards in same competition on different devices | Both card IDs and score arrays persist independently after both refresh | UNTESTED |
| A3 | A scores today; B scores tomorrow, same Winter League team/week | Team Better Ball calculated hole by hole when both cards exist; one-card team score valid until then | UNTESTED |
| A4 | A and B edit different cards simultaneously | Both updates persist; no full-state overwrite, no disappearing group/players | UNTESTED |
| A5 | Two devices edit the *same* card from same revision | First save accepted, stale second rejected; visible conflict prompt, reload/merge without silent loss | UNTESTED |
| A6 | Group admin edits B's card | Delegated edit succeeds, revision increments, B sees update after refresh | UNTESTED |
| A7 | Ordinary member attempts delegated edit or unrelated group access | Denied server-side; no scorecard or private data leakage | UNTESTED |
| A8 | B loses connectivity while scoring and reconnects | Unsaved changes remain clear; no silent overwrite; explicit retry/conflict handling | UNTESTED |
| A9 | Placeholder golfer claimed by real signed-in B | Historic cards and memberships remain linked; names propagate across joined groups | UNTESTED |
| A10 | Refresh / sign out / sign in on both devices | Same groups, memberships and scores restored; no duplication | UNTESTED |
| A11 | Finished comp results and Winter League leaderboard | All teams present; Stableford, countback, best-X-of-Y and handicap cuts match known oracles | UNTESTED |
| A12 | Existing production app smoke test (read-only observation) | Live app unchanged; no V4 feature flag or migration enabled | UNTESTED |

## Gate rules
- Automated synthetic PostgreSQL scoped RPC and scoring tests are **not** substitutes for real browser/device acceptance.
- Real-backup isolated PostgreSQL 18 rehearsal **PASSED 2026-10-09**: 123 golfers, 11 groups, 80 memberships, 35 competition scopes, 47 scorecards; all normalized contents verified; rollback verified. Source evidence: user-run local test, no protected backup copied to CI.
- A1–A11 must be executed against isolated environment, with evidence, before release can be proposed.
- Rerun chained CI on the final candidate. Document and rehearse production cutover and rollback separately.
- **Never** merge PR #51, deploy production SQL, toggle production feature flags, or copy real backup to GitHub/CI without explicit approval.
