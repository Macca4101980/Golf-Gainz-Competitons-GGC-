# Stage 6 activation gates

The opt-in V4 shadow read is connected to `src/main.jsx` and remains OFF by default. Only a build with `VITE_GGC_V4_SHADOW=true` invokes `ggc_my_memberships_v4`. It logs a membership count only; it never updates React state, membership roles, identity links, scoring, or `ggc_state`.

**Not production ready.** The following gates are mandatory before the flag is enabled for a pilot:
1. Complete protected real-backup restoration and reconciliation in an isolated database; exclude Teat explicitly only as authorized, and verify its linked test competition separately.
2. Apply and test the read RPC migration in isolated PostgreSQL, including unauthenticated denial and RLS behavior.
3. Confirm identity proof, invitation issuance, claim replay, simultaneous-device stale writes and all affected Group roles.
4. Replace legacy whole-state membership writes with server-authoritative operations before promoting shadow mode to active membership mode.
5. Back up Supabase Auth, profiles and storage separately, and rehearse rollback.
6. Run complete GGC regression, including Winter League 25/26 and 26/27 scores, cards, money and group formats.

Never enable the flag by default or claim a completed cutover based only on passing JavaScript build tests.
