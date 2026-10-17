# GGC personal course isolation — release acceptance tests

Status: SPECIFIED, NOT YET VERIFIED. No production migration or deletion permitted until the full test pack passes.

## Data ownership
1. A adds a new course. A sees it on a second device after login; B and C do not see it.
2. B imports a course with the same name. A's record, tees and hole data remain unchanged.
3. A edits a tee. B's tee data and any saved competition snapshot do not change.
4. A removes a personal course. B's record and competition snapshots remain intact.
5. Sign out/in and clear local browser cache: A's personal course list returns from Supabase.
6. An unauthorised account cannot read/write another account's private course records.

## Competition creation and scoring
7. A creates a competition from a personal course: snapshot contains all 18 holes, par, SI, yardage, selected tee, course rating and slope.
8. B and C join without saving/importing that course; both open 18-hole scorecards with identical details.
9. A edits/deletes the personal course; B and C continue scoring with the unchanged competition snapshot.
10. Score calculation and handicap strokes use the competition snapshot for individual, pairs and every group format.
11. Concurrent B/C scores persist independently; refresh and cross-device reads preserve each.
12. Front 9, back 9 and 18-hole competitions use correct hole order and stroke indexes.
13. Missing or incomplete snapshot blocks starting a *new* competition/round with a clear error; no silent local-library fallback for new competitions.
14. Existing competition snapshots are immutable once scoring starts, except an audited authorised edit.
15. Group and individual scorecards agree on par, SI and tee settings.

## Migration and regression
16. Dry-run migration against the isolated test database with counts and owner mappings; unmatched owners are quarantined, not guessed.
17. Verify record IDs, invitations, group memberships, scores, handicap indices and course metadata before/after.
18. Old competitions lacking snapshots are backfilled from authoritative saved data without changing cards; unresolved courses are flagged for manual review.
19. Test signed-in A/B/C on iPhone and desktop, including offline/reconnect and simultaneous edits.
20. Full scoring engine and Master Regression Audit; verify no deleted/overwritten production records.
21. Rehearse rollback with production backup and deploy only after automated tests, test-environment checks and cross-device sign-off.

Required evidence: automated test logs, migration before/after counts, three-account results, Vercel build/deployment status.
