# GGC Chunk A — functional recovery inventory (18 October 2026)

**Scope:** source inspection of recovery branch (PR #66), comparison with prior GGC requirements and GitHub CI. This is **not** a live-device, production-database or complete functional acceptance audit. Status terms: CODE PRESENT, TESTED IN CI, UNVERIFIED, BLOCKER.

## Confirmed baseline
- Recovery branch: `fix/record-saving-and-score-entry-20261018`, draft PR #66, separate from `main`.
- At commit `a9d527d`: 201/201 Node tests passed in each of three CI workflows; Vite builds passed. This does not establish production deployment.
- Package identifies `4.0.0-beta.1`.

## Functional inventory
| Area | Source evidence | Assessment / remaining verification |
| --- | --- | --- |
| Individual and pairs formats | `src/main.jsx` declares Stableford, nett/gross stroke, Par/Bogey, Maximum Score, Modified Stableford, Flag, Eclectic, Waltz, 4BBB Stableford/Stroke, Aggregate Stableford/Stroke, pairs matchplay, blind pairs | CODE PRESENT; complete format-by-format expected-score regression outstanding |
| Group formats | `src/main.jsx` lists Texas Scramble, Scramble, Florida, Shamble, Best 1/2/3, Cha Cha Cha, Irish Fourball, Bowmaker, Alliance, Yellow Ball; `src/groupScoring.js` declares corresponding rules and `src/GroupScoreScreen.jsx` is wired into `ScoreScreen` | CODE PRESENT; rules, permissions and live save path need independent checks |
| Competition course snapshots | `src/competitionCourse.js` copies selected tee's 18 holes; `CompModal` creates `courseSnapshot` and rejects incomplete tee; scoring calls `competitionCourse` | CODE PRESENT for new comps; **BLOCKER:** `competitionCourse` still falls back to personal `state.courses` when `courseSnapshot` absent. No evidence all existing comps have snapshots or that every snapshot has correct rating/slope |
| Cloud record persistence | `src/recordStore.js`, `src/recordSaveCoordinator.js`, `src/recordChanges.js`, `src/editProtection.js`, `src/scorecardConflict.js` | TESTED IN CI for isolated cases; live multi-user/RLS and old-record migration UNVERIFIED |
| Cloud configuration | `src/main.jsx` defines `RECORD_READ_ENABLED=CLOUD&&VITE_GGC_RECORD_READ==='true'` and `RECORD_STORE_ENABLED=RECORD_READ_ENABLED&&VITE_GGC_RECORD_STORE==='true'`; `saveCloud` refuses legacy whole-state writes | **BLOCKER:** confirm both variables in release environment and no save paths silently fail when disabled |
| Scorecard UI | `ScoreScreen` in `src/main.jsx`; `GroupScoreScreen.jsx` for group formats; scorecard conflict/retry modules | CODE PRESENT; sticky layout, partial cards, iPhone, cross-device reopening and save confirmation UNVERIFIED |
| Winter League | `src/winterLeague.js`, live league table uses `winterLeagueTable(liveLeague,displayState)` and `liveLeague.teams` | TESTED IN CI for selected cases; full live standings, cuts, 90% allowance, single-player scoring, OOM and existing league data UNVERIFIED |
| Result embargo | `src/main.jsx` references `resultsEmbargo`, provisional masking and release time | CODE PRESENT; 15-hole display, official 18-hole totals and permission/release-time behaviour UNVERIFIED |
| Groups/invites | `src/groupMembershipApi.js`, `shareClaimInvite`, `emailClaimInvite`, group join code in `SocietyModal` | CODE PRESENT; real recipient joins, duplicate identity merge, pending invite persistence and admin-only changes UNVERIFIED |
| Competition administration | `CompModal` has save-time owner/admin check; `LifecycleControls` allows admin or creator; settings UI in `SettingsHub` | CODE PRESENT; full mutation permission matrix and database enforcement UNVERIFIED |
| Money/results/OOM | `LeagueMoneyManager`, leaderboard, results and OOM logic in `src/main.jsx` | CODE PRESENT; live navigation, calculations and no duplicate/blank standings UNVERIFIED |
| Mobile/PWA and badges | `src/style.css`, JSX UI and badge fields | CODE PRESENT; device layout, safe area, upload/remove, form retention UNVERIFIED |
| Data recovery | Record-mode coordinator and `legacyCloudStore.js`; migration helper `migrate` in `main.jsx` | **BLOCKER:** complete real-backup migration and rollback rehearsal not signed off |

## Highest-priority integration gaps discovered
1. **Old competition course fallback:** existing competitions without a snapshot can use a local library; audit production data read-only, prepare a non-destructive snapshot backfill, and test it against a copy. Never guess course/tee values.
2. **Feature flags / write availability:** new `saveCloud` explicitly throws when record mode is disabled; inspect deployed environment and all mutation call sites for user-visible failure and preservation of edits.
3. **Save-before-confirm flows:** group scoring's `persist(next)` calls `setState(next)` before awaiting `onPersist(next)`; `ScoreScreen` passes `saveCloud` as `onPersist`. Check every workflow's retry/error UI and whether changes remain protected on failed persistence.
4. **Authorization:** UI checks are not a substitute for authenticated RLS testing; test own card, playing partner, group admin, outsider and forged ownership changes on a safe test database.
5. **Live data parity:** CI fixtures do not prove existing groups, golfers, invitations, leagues, badges, scores and links survive record-mode migration.

## Chunk A outcome
**Source-level inventory completed for core functionality.** The evidence supports widespread presence of previously developed features, but not their complete integration or production readiness. No claim of missing features without stronger evidence. Chunks B–D own execution and remediation; Chunk E owns rollout.

## Release gate
Do not merge or deploy solely because CI is green. Resolve data migration, permissions, existing competition snapshots, write-mode configuration and real multi-device scoring acceptance first.
