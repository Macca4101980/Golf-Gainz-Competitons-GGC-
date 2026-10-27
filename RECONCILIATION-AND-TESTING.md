# Beta 11.1 reconciliation — 27 October 2026

Production was restored to f489ce8a50affec6709c7072eb2a3aee9d105fad (Beta 10), deployment dpl_CrMVZ9t3gWXwGpaTJHrYLA6RXZDr. Faulty main release 2ce29604cb74763c14fa1b04ca4297e87dcbbb6d was based on older code. This reconciliation merges both histories, uses production code to resolve conflicts, and reapplies only the four requested fixes.

Retained: password changes/recovery, player identity handling, field-level saves and conflicts, Group membership RPCs, admin scorecards, immutable competition courses, league scheduling, provisional handicaps and result embargoes. Core modules remain identical to the production baseline; main.jsx has only the reviewed fix and label changes.

Reapplied: confirmed competition invitation decline through the existing record-save path; main navigation scroll reset; inline invalid/expired join-code feedback using the server RPC; solo non-matchplay pairs scorecard launch while preserving existing pairs.

## Testing evidence and limits

Earlier Beta 10 browser evidence: login and group access; successful join and duplicate-join protection; owner/member permissions; score autosave, reopen and refresh; N/R persistence; independent player cards; admin opening/editing another card; full-round submission and leaderboard persistence; mobile scorecard width; visible Change Password. These checks remain valid historical evidence for Beta 10, not release approval for 11.1.

Faulty Beta 11: 118 automated tests passed against the wrong baseline. Live tab scroll reset, invalid-code message and solo 4BBB opening were observed. Invitation decline persistence and cross-browser completion were not verified. Cloud save failure invalidates its persistence sign-off. Do not carry that release approval forward.

Earlier overall progress was reported as approximately 60%; no complete enumerated denominator was recorded, so this is a planning estimate, not measured coverage. Do not increase it from automated test totals.

Outstanding release checks: authenticated candidate save/reopen/refresh; two-session independent saves and conflict handling; decline cancellation/confirmation/persistence; valid/invalid join; solo 4BBB save and team result; Change Password visibility/validation; admin cards; mobile navigation; regression of league scoring/permissions. No database edits or production data repairs are part of this reconciliation.

## Release safeguards

CI checks ancestry against RELEASE-BASELINE.json. Before deployment, independently obtain the current production SHA and supply PRODUCTION_COMMIT to scripts/check-release-baseline.mjs. Update the recorded baseline after a verified release. Branch protection and Vercel required checks must be configured to make CI a platform-enforced promotion gate; this file does not claim those settings are enabled. Production remains Beta 10 until candidate verification and explicit promotion.
