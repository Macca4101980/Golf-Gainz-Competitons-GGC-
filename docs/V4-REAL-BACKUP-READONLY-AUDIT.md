# V4 protected-backup audit — read-only, 2026-10-08

Protected production backup ID: `373f8a26-c527-4d7a-b8b6-2d61617ae609`.
No backup payload, golfer names, emails, tokens or scorecard contents are stored in this repository.

## Read-only findings

- 12 groups, 36 competitions, 48 scorecards.
- No orphaned competition group IDs, no scorecard-to-competition group mismatch, no orphaned scorecard golfer IDs.
- No duplicate golfer, group, competition or scorecard IDs.
- One test group named **Teat**, with one competition and one scorecard.
- **Teat actual group ID:** `75eea654-ebc2-4e8a-8479-0acaa8a91c2d`. The literal `teat` is **not** its ID.
- Expected after explicitly excluding that ID: **123 golfers, 11 groups, 80 distinct memberships, 35 competitions, 47 scorecards**.
- Three unresolved membership references exist in the excluded test group; **zero unresolved membership references remain in retained groups**.
- Zero retained groups or golfers have missing IDs or display names.

## Isolated rehearsal (not yet completed with protected backup)

Obtain snapshot securely without committing it or exposing personal data in logs. Use a **local disposable PostgreSQL database only**, with staged V4 schema loaded. Set:
```sh
GGC_V4_EXPECTED_COUNTS='{"golfers":123,"groups":11,"memberships":80,"competitionScopes":35,"scorecards":47}' \
GGC_V4_TEST_DATABASE=1 \
GGC_V4_EXCLUDED_GROUP_IDS=75eea654-ebc2-4e8a-8479-0acaa8a91c2d \
DATABASE_URL=postgres://...@localhost:5432/... \
node scripts/v4-rehearse-import.mjs /secure/local/snapshot.json
```
Rehearsal refuses non-local database URLs, unmatched exclusion IDs and unresolved references; verifies imported counts and complete scorecard JSON; rolls back. Never point at production or run against a database with valuable data.

**Status:** Backup referential audit passed. Real-backup import-and-rollback **not yet run**. Production migration and feature flags remain on hold.
