-- Stage 7: authoritative memberships must not be writable through stale JSON clients.
-- No direct client table permissions. Server-side verified RPC is the only claim path.
revoke insert,update,delete on public.ggc_golfers from anon,authenticated;
revoke insert,update,delete on public.ggc_groups from anon,authenticated;
revoke insert,update,delete on public.ggc_memberships from anon,authenticated;
revoke insert,update,delete on public.ggc_identity_links from anon,authenticated;
revoke insert,update,delete on public.ggc_claim_invites from anon,authenticated;
-- The legacy ggc_state JSON remains a historical/compatibility store.
-- IMPORTANT: this does not prevent old devices from rewriting membership data
-- inside ggc_state. Do not treat this migration alone as full cutover.
