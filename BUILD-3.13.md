# GGC Build 3.13 — Live Sync
- Subscribes to Supabase Realtime postgres_changes for public.ggc_state id=main.
- A database change triggers a fresh canonical state fetch, updating invitations, memberships, competitions, cards and leaderboards without reopening the app.
- Re-fetches when the app/browser becomes visible, regains focus, or comes back online.
- Header reports ● Live when subscribed, Live synced after an incoming change, and Reconnecting… on channel timeout/error.
- Retains 3.12.2 iPhone modal scrolling, 3.12.1 society UI, 3.10 auth, and existing scoring.
Note: this improves live visibility but the current single shared JSON row can still have simultaneous-write collision risk. Normalized tables/RLS remain the long-term architecture.
