# GGC isolated test environment

Supabase test project: `omgnfrybqiqgxnpwgfol` (EU West 1).

## Isolation rules
- Never configure production Vercel environment variables to point to this test project.
- Never connect this test deployment to the production Supabase project.
- Use a distinct Vercel test project and distinct test accounts.
- No production data is to be imported without an explicit sanitisation and approval step.
- Never merge this branch into `main` before regression tests and review.

## Current test database
- `public.profiles`: per-auth-user profile with owner-only RLS.
- `public.ggc_state`: `(owner_id, id)` primary key, `payload`, `revision`, `updated_at`; owner-only RLS.
- Both tables start empty.
- This is **not compatible** with the current app's `ggc_state?id=eq.main` fetch and upsert without an adapter.
- The `revision` field does not itself prevent lost updates. A compare-and-swap RPC or equivalent atomic update is required.
- Owner-only state is suitable for isolated smoke testing, **not** for multi-user society collaboration. Shared group membership and permissions need a separately designed authorisation model.

## Required before deployment
1. Build a test-only adapter to filter state by `owner_id`, and include `owner_id` on writes.
2. Add atomic revision checks; reject and reconcile conflicting saves.
3. Implement group membership-based access before testing shared competitions.
4. Set test Vercel `VITE_SUPABASE_URL=https://omgnfrybqiqgxnpwgfol.supabase.co` and test project's **publishable** key only. Never commit keys.
5. Run `npm test`, `npm run build`, and browser tests against the test project.
6. Run the independent 18-hole scoring test pack, invitation/join-code tests, two-device sync tests, and the accumulated Master Regression Audit.
7. Confirm the exact Beta.14 commit; repository main currently declares `4.0.0-beta.1`. Do not mark Beta.14 verified until resolved.

## Status
- Test database tables created and verified; RLS enabled; Supabase security advisor returned zero findings.
- App adapter, revision control, test deployment, and scoring tests: **not yet completed**.
