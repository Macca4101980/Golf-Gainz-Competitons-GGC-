# Server-side CAS rollout — HOLD
Server-side CAS code is on the development branch; **not enabled or deployed**.

## Required order
1. Run `docs/sql/V4_STATE_CAS_CUTOVER_HOLD.sql` in an isolated database with a copy of the existing `ggc_state` table and role permissions.
2. Test two concurrent authenticated clients: same initial revision, first succeeds, second receives SQLSTATE 40001, original state unchanged.
3. Test unauthenticated RPC, incomplete payload, and a legacy REST POST/PATCH; all must fail after cutover.
4. Confirm `ggc_state.updated_at` is NOT NULL, has sufficient timestamp precision and the existing app always reads it.
5. Complete real-backup rehearsal, Group/identity reconciliation and the entire GGC regression audit.
6. Schedule coordinated deployment: ensure server RPC exists, build with `VITE_GGC_SERVER_CAS=true`, then enforce legacy write revocation at the planned cutover. Confirm no old clients can save, and provide an update/reload message.
7. Pilot across two devices and accounts; monitor conflicts and missing-data reports; keep rollback instructions and backups available.

**Do not execute cutover SQL in production yet.** Old clients will lose cloud write access by design. Existing legacy `VITE_GGC_CAS_WRITES` uses conditional REST PATCH but does not block old clients.
**Limit:** server CAS prevents silent lost updates; it does not automatically merge concurrent edits. On conflict, the user must reload and reapply unsaved changes. A future operation-level sync is needed for conflict-free simultaneous scoring.
