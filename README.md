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


## Build 3.1 Passkeys
Adds Supabase WebAuthn passkey registration/sign-in. Requires Authentication > Passkeys enabled with RP ID golfgainzcomps.co.uk and origin https://golfgainzcomps.co.uk. Email OTP remains fallback/recovery. OTP input accepts 6-10 digits.

## Build 3.2 additions
- Society creation no longer requires an Admin PIN; authenticated owner/admin roles control management.
- Society naming copy clarified and example placeholder removed.
- Society owners can permanently delete a society after a destructive confirmation.
- New competition defaults: Stableford, no course/tee selected, £0, 1 day, separate daily pots on, 100/0/0 pot and prize split.
- Prize weighting and overall split auto-balance to exactly 100%.
- Played-with contacts and future competition invites; contacts can be removed with confirmation.
- Active competition is remembered locally so returning to the site offers Continue Scoring; hole scores already autosave to local/cloud state.

## Build 3.4
- Permanent player profile table keyed directly to Supabase Auth UUID. A deployment/browser cache change no longer defines the user's identity.
- Run `supabase-setup-3.3.sql` once in Supabase SQL Editor before testing this build.
- Passkey status is stored on the cloud profile. My Golf changes to “Passkey enabled” and offers “Set up a new passkey” after successful registration.
- Prize Pot Weighting and Overall Prize Split use 10% dropdowns and remain constrained to 100%.
- Existing competition/society state remains in `ggc_state` for this migration build so current data is not intentionally discarded.
