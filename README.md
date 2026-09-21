# Golf Gainz Comps — Build 2

Build 2 adds the dark/lime GGC identity, working competition entry/scoring, private Societies with join codes and sharing, and verified Northampton Golf Club (Harlestone) White/Yellow/Red tee data.

Existing Build 1 local data is migrated into a default society. Supabase continues to use the single `ggc_state` JSON payload, so no schema migration is required if Build 1 Supabase is already configured.

## Build 2.3
- Society creator becomes Owner/Admin and creates a persistent hashed society PIN.
- Existing societies migrate their first member to Owner/Admin for compatibility.
- Society Admins can promote/revoke other member Admins and change the society PIN.
- Competition creators can edit their own competitions; society Admins can edit all society competitions.
- Competition create/edit actions are written to the audit log.
- Live Leaderboard is available directly from competition cards.
- Edit Competition button contrast improved.
- Entering a competition registers the current player as an entrant.
- Score-entry player selector only lists golfers who have entered that competition; no free-text Add Golfer.

Security note: Build 2.3 still uses the shared ggc_state cloud document. UI permissions and hashed PINs are implemented, but true server-enforced per-user RLS requires Supabase Auth + normalized tables in a later backend migration.

## Build 3.0 authentication
Build 3.0 adds Supabase email OTP sign-in. Returning users with a valid session go straight into GGC. New authenticated users are asked to create a display name and Handicap Index. The email address is held by Supabase Auth and is not copied into the shared GGC state or displayed to society members.

For a 6-digit email code, configure the Supabase Auth email template to include `{{ .Token }}`. Existing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY variables are used.

## Build 3.1 — Passkeys
- Adds Supabase WebAuthn passkey support using `@supabase/supabase-js` 2.105+ experimental passkey API.
- Welcome screen offers **Sign in with Face ID / Passkey** plus email OTP fallback.
- My Golf offers **Set up Face ID / Passkey** for an authenticated golfer.
- Email OTP input accepts 6–10 digits so it works with the project's current OTP length while settings are being finalised.
- Supabase Dashboard must have Passkeys enabled with RP ID `golfgainzcomps.co.uk` and origin `https://golfgainzcomps.co.uk`.
