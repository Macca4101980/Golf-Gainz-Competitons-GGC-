# Beta 12 public shareable leaderboard

Status: implemented on beta-12-public-leaderboard; production Beta 11.1 unchanged.

## Behaviour

- Group owners/admins enable, publish, replace and disable a competition link from its leaderboard. Server authorization uses authoritative group roles. Normal members cannot manage links.
- Anyone holding the 256-bit bearer link can view without signing in. Only the SHA-256 token hash is stored. The token is in the URL fragment, outside the initial page request and referrer.
- The public page refreshes saved scores every 15 seconds, including when the organiser has closed GGC. An isolated Edge Function uses the exact application scoring modules.
- Names are shown by default on shared leaderboards. Each golfer can opt out under My Golf; opt-out is applied at read time. A team is anonymous if any member has not opted in. Private golfer IDs, emails, handicaps, access codes, cards, payment information and audit data are excluded from responses.
- Winter League uses fixed teams, single-player cards and the existing scoring rules. Embargoed holes are removed before score calculation; scramble teamGross is masked too. Malformed enabled embargo settings fail closed.
- Replacing a link invalidates the old token. Disabled links cannot be refreshed back into service. Source-version checks reject calculations built from stale records.
- Each competition leaderboard has its own share icon. The public page reuses the GGC leaderboard row layout and remains read-only. Group public sharing is on by default; an owner/admin can switch it off in Settings, which blocks new and existing public reads and shows an admin-disabled message when a share button is pressed. Competition-level results are supported. Singles Matchplay and unverified scoring formats are rejected explicitly; league-wide OOM sharing is outside this implementation.

## Isolation and deployment

Production verified on 27 October 2026: 5d82994698e1d80e6dcee1f153568cc0733423b6, deployment dpl_FXNPyysL3eYaPg84GmTjMoi3bSCn. The branch contains this commit and scripts/check-release-baseline.mjs passes with that SHA.

Only test Supabase project omgnfrybqiqgxnpwgfol was changed. Its beta12-public-leaderboard Edge Function is deployed. Production database, main branch and production hosting were not changed. The new migration was created using the Supabase CLI and executed against test for verification. Apply the checked-in migration through the normal controlled release process only after staging verification.

The Edge Function deliberately authenticates anonymous requests with the share bearer token. JWT verification is disabled for this function; source and commit RPCs accept service_role only. Service credentials remain server-side. Public wrappers use SECURITY INVOKER; privileged helpers are in the private schema with explicit grants. RLS and revoked table grants deny direct public/authenticated table reads.

Run npm run package:public-leaderboard after changing scoring modules, before deploying the Edge Function. Its checked-in copies must match src. No new runtime dependency was added.

## Verification performed

- Complete automated regression suite: 200 passed; zero failures.
- Vite build: passed.
- Production ancestry check: passed against the freshly verified actual deployment.
- Transactional test database checks: owner publication; member/anonymous management denied; direct table reads denied; names visible by default; immediate opt-in/out; Group sharing on/off; token rotation and revocation; version conflicts; service-only source access; stale source rejection. Fixtures rolled back.
- Real anonymous HTTP checks against the test Edge Function using a synthetic ten-week season: four complete team rows; saved card correction changes public points without an organiser session; unchanged results retain their timestamp; 15-hole embargo enforced; private fields absent; revoked token returns null. All committed synthetic records and users were deleted after testing; remaining fixture count zero.
- Security advisors: no new exposed SECURITY DEFINER warning for leaderboard APIs. Two INFO notices reflect intentional RLS tables without public policies; pre-existing unrelated test-project warnings remain unchanged.

## Outstanding release checks

Browser UI verification is blocked by the Windows browser sandbox failing to start (missing or outdated sandbox setup). Authenticated admin clicks, copy-link UX, mobile layout, save/reopen and two-session browser checks are unverified. No production promotion is requested or performed. Full GDPR review and load/rate-limit testing remain outstanding.
