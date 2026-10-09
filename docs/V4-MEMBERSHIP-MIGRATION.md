# V4 identity migration rollout

## Preconditions
- Verified state backup: 373f8a26-c527-4d7a-b8b6-2d61617ae609
- Take separate Auth/profiles/storage backups before production cutover.
- Test restoration in an isolated environment.
- Keep existing ggc_state writes until all readers and writers are migrated.

## Sequence
1. Apply additive schema in an isolated test database; verify foreign keys and RLS deny direct anonymous access.
2. Import golfers and groups from a consistent snapshot, preserving original IDs.
3. Import memberships without assuming identical names represent identical people.
4. Resolve candidate placeholders only with confirmed account linkage; preserve scorecard references.
5. Implement transactional claim RPC with authenticated ownership verification, idempotency, membership transfer and audit log.
6. Move invite/join/claim and membership reads to RPC/table-backed operations.
7. Test concurrent devices, offline stale writes, multi-group claims, historical scoring, and rollback.
8. Deploy via phased cutover; audit all affected golfers after deployment.

## Critical caution
The current identityLinks object in ggc_state is a temporary client-side mitigation, not an authoritative source. Do not bulk merge based solely on name or handicap. No destructive SQL is part of this migration.
