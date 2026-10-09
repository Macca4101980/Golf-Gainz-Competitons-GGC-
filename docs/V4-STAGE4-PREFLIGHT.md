# Stage 4 — migration preflight (2026-10-08)

Source: immutable application-state snapshot `373f8a26-c527-4d7a-b8b6-2d61617ae609`. Read-only SQL only.

| Check | Result |
|---|---|
| Golfer IDs | 123 rows / 123 distinct |
| Group IDs | 12 rows / 12 distinct |
| Auth-linked golfers | 30 |
| Group membership IDs without matching golfer | **1 (FAIL)** |
| Isolated Supabase branch available | **No** |
| Transactional claim integration tested | **No** |

Missing membership reference: group `75eea654-ebc2-4e8a-8479-0acaa8a91c2d` (Teat), golfer ID `d68bac83-dcd4-4f36-acfb-df859c2a34cc`. Preserve for investigation; do not silently delete.

## Required before migration execution
1. Obtain approval for any Supabase development branch cost, or provide an independent disposable PostgreSQL test instance.
2. Take separate verified auth/profiles/storage backups.
3. Add migration importer that validates references and records unresolved IDs rather than dropping them.
4. Add executable transaction tests (valid claim, wrong token, expired token, wrong verified email, replay, competing accounts, multi-group role preservation).
5. Add browser multi-device regression tests and rollback rehearsal.
6. Fix initial schema/claim integration and review privileges before applying any migration.

**Stage 4 is blocked for live execution until these checks pass.** No production writes were made.
