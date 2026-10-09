# GGC release gate — 10 October 2026

## Release rule
Do not deploy the experimental record-level persistence path until all gates pass. Production remains on the existing data model. No live migration or golfer merge without verified backups.

## Change register
| ID | Change | Status | Evidence |
|---|---|---|---|
| R01 | Isolated `ggc_records` schema, revisions, tombstones | Applied in isolated Supabase | Table inspected |
| R02 | Version-checked record adapter | Committed; unverified | `src/recordStore.js` |
| R03 | Change planner avoids unrelated writes | Committed; unverified | `src/recordChanges.js` |
| R04 | Serialized saves with committed baseline | Committed; unverified | `src/recordSaveCoordinator.js` |
| R05 | Experimental integration in GGC | Committed; disabled by default | `VITE_GGC_RECORD_STORE` opt-in |
| R06 | Automated regression + build workflow | Committed; awaiting result | `.github/workflows/ggc-regression.yml` |
| R07 | Secure per-group read/write RLS | BLOCKED / not applied | Access controls not yet implemented |
| R08 | Verified migration from production blob | NOT STARTED | Requires backup + mapping |
| R09 | Draft-safe editing on every screen | NOT STARTED | Current focus guard is insufficient |
| R10 | Identity links, duplicate prevention | NOT VERIFIED | No live golfer merges |
| R11 | Concurrent real-client tests | NOT RUN | Need two signed-in clients |
| R12 | Full master regression suite | NOT RUN on this commit | Workflow added |
| R13 | Production release | NOT DEPLOYED | Requires passing gates |

## Tomorrow-use smoke test
- Existing account login and session restore
- Group membership and invitation code join
- Winter League 26/27 visible to correct members
- Score a single player's card; verify partner's card unchanged
- Edit a saved scorecard and confirm persistence after refresh
- Verify Stableford and Better Ball leaderboard calculations
- Confirm league standings and handicap cuts
- Confirm second device does not erase first device's score
- Confirm unsaved form text survives incoming refresh
- Confirm old golfer identity is not duplicated by registration
- Verify competition creation, edit and results
- Verify no blank/black screen or unexpected navigation

A green build/test workflow is necessary but not sufficient for production release. The above manual multi-user checks must also pass.
