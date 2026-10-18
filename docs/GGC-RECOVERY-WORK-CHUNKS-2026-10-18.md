# GGC recovery — work chunks (18 October 2026)

Evidence: recovery PR #66, head a9d527d; three GitHub Actions workflows passed (201/201 unit tests and successful Vite build). Automated checks do not establish live iPhone or database behaviour.

## Chunk A — Functional inventory (IN PROGRESS)
- Compare recovered modules against user requirements and 18 October bug register; distinguish present code from deployed and verified functionality.
- Observed: src/competitionCourse.js exports snapshotCompetitionCourse and competitionCourse; competitionCourse still falls back to state.courses if the competition has no snapshot. New competition creation requires an 18-hole snapshot. Existing competitions are NOT proven migrated. **Release blocker until old competition snapshots are checked/migrated.**
- Observed: src/GroupScoreScreen.jsx implements group-round score entry, but its live behaviour and permissions remain unverified.
- Observed: src/main.jsx requires VITE_GGC_RECORD_READ=true AND VITE_GGC_RECORD_STORE=true for record mode; saveCloud throws GGC_RECORD_MODE_REQUIRED otherwise. Confirm deployment environment before release.
- Observed: main.jsx has multiple saveCloud call sites; check error handling and whether UI state changes before server confirmation in each critical workflow.

## Chunk B — Record persistence and data integrity (NOT SIGNED OFF)
- Verify two independent golfers' cards, cross-device conflicts, offline edits, retries, permission-safe writes and no whole-state overwrite.
- Validate migration and links for existing golfers, leagues, comps, courses, invitations and cards using a copy/test environment. Do not modify production records as a test.
- Review Supabase RLS using actual authenticated roles; reading policy definitions alone is insufficient.

## Chunk C — Competition/scoring feature matrix (NOT SIGNED OFF)
- Independently test every advertised individual, pairs and group format with known expected results; 18-hole and restricted-hole display; competition snapshot data for all entrants.
- Check scorecard editing, handicap allowances, matchplay, countback and live leaderboards.

## Chunk D — Groups, leagues and user journeys (NOT SIGNED OFF)
- Verify invites, claim links, joining by code, guest merges, admin restrictions, Winter League team scoring, cuts, OOM, results, payouts and badges.
- Check mobile layouts and form-state retention on iPhone.

## Chunk E — Release and acceptance (BLOCKED)
- Confirm production backup, restore rehearsal, deployment configuration, rollback and release approval.
- Then iPhone plus second-device acceptance: enter, save, close, reopen, and independently edit two different cards without losing scores.

## Status rules
- PASS = test executed and evidence observed; CODE PRESENT = identified in source only; UNVERIFIED = no conclusive evidence; BLOCKED = must resolve before production.
- No claim of deployed or fixed based only on a source edit or passing static test.
- PR #66 remains draft and production unchanged until release approval.
