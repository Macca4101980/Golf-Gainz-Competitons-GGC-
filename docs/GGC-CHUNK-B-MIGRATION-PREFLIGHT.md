# Chunk B — migration preflight and access review

18 October 2026. Isolated test Supabase only. All checks below were read-only; no migration executed.

## Verified
- CI at e04c7268: 205/205 tests passed; three workflows green.
- ggc_records: 19 total rows, one deleted, sum of versions 73.
- Seven active scorecards: zero missing competition references, zero missing player references.
- Three active competitions: zero missing course references, zero missing society references.
- Three competitions lack courseSnapshot; all three reference the stored 18-hole White tee. Course rating 71.4, slope 125, 18 distinct stroke indexes, no invalid hole par or SI found.
- The new read-only migration planner is in src/competitionCourse.js, with two automated tests.
- No null owner_id rows; all seven active cards have **one database owner**. This dataset alone cannot prove cross-owner or independent-golfer saving.
- Test ggc_records policies provide owner INSERT, SELECT, UPDATE and shared-member SELECT. Test ggc_state policies restrict SELECT, INSERT and UPDATE to owner_id=auth.uid(). No live authenticated role test has been run.

## Security investigation
- Test ggc_can_read_shared is SECURITY DEFINER and callable by anon, authenticated and service_role; it explicitly checks auth.uid() and returns false for null. Its courses branch compares comp.data->>'courseId', while existing competition records use data->>'course'. This is a plausible shared-course visibility defect, not yet an authenticated reproduction. Do not modify production policy based solely on this observation.

## Unfinished release gates
- Verified recoverable backup and actual rollback rehearsal.
- Authenticated owner/member/outsider permission tests on isolated accounts, including forged ownership and cross-group IDs.
- Migration rehearsal using a safe database copy, preserving version and record references.
- Two independently authenticated golfers entering and reopening scores on two devices, including conflict recovery.
- Confirm Vercel record flags are actually true on the release target.

**Chunk B is not signed off. No production data changed.**
