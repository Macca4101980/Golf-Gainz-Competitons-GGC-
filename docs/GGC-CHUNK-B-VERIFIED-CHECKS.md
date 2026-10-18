# Chunk B — verified checks, 18 October 2026

## CI
Recovery commit b72c342c: three workflows successful. Build Test log: 203 tests, 203 pass, zero fail; Vite build passed. New group-scorecard failure notice and tests are on the branch, not production.

## Read-only isolated test database
Connected to test project omgnfrybqiqgxnpwgfol. Record inventory: 6 players, 3 competitions, 7 cards, 2 societies, 1 course. No data changed.

All three competitions lack courseSnapshot. All three refer to the same stored course and White tee; the referenced course exists in test records and White tee contains 18 holes. This is a viable **candidate** for a controlled snapshot migration rehearsal, but rating, slope, hole validity, versions, and backup parity must be validated first. Do not backfill without review and rollback.

Test RLS policies: owner INSERT/SELECT/UPDATE tied to auth.uid(); shared-member SELECT via ggc_can_read_shared. These are policy definitions only, not authenticated user-role execution tests. Production policies may differ.

## Configuration
Vercel production has encrypted VITE_GGC_RECORD_READ and VITE_GGC_RECORD_STORE entries. Values were not read. Generic preview entries were not listed. Validate correct values in a safe preview before release.

## Remaining blockers
Authenticated role-based permission tests, migration rehearsal and backup validation, real two-device scorecard save/reopen, error recovery end-to-end, production environment validation. Do not merge or deploy until signed off.
