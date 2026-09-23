# GGC Master Regression Audit

## Status key
- 🔵 **BLUE** — changed/fixed in this build and tested successfully.
- 🟢 **GREEN** — previously working, unchanged, regression-tested and still passes.
- 🟠 **AMBER** — not yet live-tested or depends on the deployed Supabase/device environment.
- 🔴 **RED** — currently broken/current failure.
- ⚫ **BLACK** — regression: previously working but this build has broken it.

## Build 3.2.1 — Regression & Stability

| Status | Area | Audit result |
|---|---|---|
| 🔵 | OOM / Blind Pairs | Handles both historical pair arrays and `{ids, score}` pair objects; malformed pair records are ignored instead of crashing OOM. Automated helper regression passed. |
| 🔵 | Blind Pairs odd field | Draw is blocked for an odd number of golfers instead of duplicating the first golfer. |
| 🔵 | Blind Pairs persistence | One-time draw now uses an explicit immediate cloud save. |
| 🔵 | Competition create/edit | Uses explicit next-state + immediate cloud persistence. |
| 🔵 | Competition invitations | Invite change now persists immediately. |
| 🔵 | Competition lifecycle scoring lock | Completed/cancelled competitions reject further score edits/saves even if a Score screen was already open. |
| 🔵 | Card Save / Submit | Explicit card save/submit now persists immediately; individual hole entry remains on the existing debounced autosave by design. |
| 🔵 | Front 9 / Back 9 / 18 edit | Changing the hole set after scores exist warns that scorecards will be reset; cancellation leaves them untouched. |
| 🔵 | Regression test pack | 8-golfer test-pack loader restored in Settings and merges the test pack without deleting normal groups. |
| 🔵 | Supabase setup files | Obsolete anonymous-policy SQL removed; one authenticated setup SQL remains. |
| 🟢 | Stableford | Deterministic 8-golfer regression: 31, 33, 38, 40, 35, 34, 31, 32. |
| 🟢 | Nett Stroke Play | Deterministic regression: 77, 75, 70, 68, 73, 74, 77, 76. |
| 🟢 | Gross Stroke Play | Deterministic regression: 73, 73, 74, 76, 86, 93, 103, 115. |
| 🟢 | Par / Bogey | Deterministic regression: -4, -3, +1, +3, -1, -2, -4, -4. |
| 🟢 | Blind Pairs individual scoring | Deterministic Stableford card outputs retained before the draw. |
| 🟢 | OOM field-size bands | Under 5 = none; 5–8 starts 10; 9–12 starts 12; 13–16 starts 14; 17+ starts 16, descending by 2. |
| 🟢 | Plus handicaps | Signed plus-HI calculation and negative hole strokes regression-tested. |
| 🟢 | Blank score `+` / `−` | `+` from blank = Par; `−` from blank = Birdie. |
| 🟢 | Realtime echo guard | 3.13.7 `remoteStateRef` protection retained. |
| 🟢 | Groups page | Core GroupsPage source is byte-for-byte unchanged from the 3.2 baseline during this rebuild. |
| 🟠 | Leave Group | Proven in an earlier live build; code retained, but requires post-deployment live regression on 3.2.1. |
| 🟠 | Remove Member / Admin / Ownership | Previous immediate-save fixes retained; multi-account live regression required on 3.2.1. |
| 🟠 | Group Invite Accept/Decline | Previous immediate-save fix retained; two-device live regression required. |
| 🟠 | Delete Group | Explicit selector/immediate save retained; live persistence test required. |
| 🟠 | Delete / End / Cancel / Reopen Competition | Code checks pass; live persistence and UI-state test required. |
| 🟠 | Auth / OTP / persistent session | Source retained; requires deployed Supabase login test. |
| 🟠 | Passkey / Face ID | Requires supported iPhone/browser/Supabase live test. |
| 🟠 | Global Courses | Add-course immediate persistence retained; cross-account visibility needs live test. |
| 🟠 | Realtime multi-device refresh | Requires two live devices. |
| 🟠 | Simultaneous live scoring | Known architectural limitation: whole `ggc_state` last-write-wins remains. This is deliberately not “fixed” by increasing whole-state writes. Planned normalized scoring architecture. |
| 🔴 | Prize-money settlement engine | Entry fee/payout settings exist, but a complete who-is-owed-what settlement/payment engine is not yet implemented. |
| 🟠 | Local Vite production compile | `npm install` could not complete within the execution environment timeout. Vercel deployment remains the production compile test. |
| ⚫ | Regressions introduced by 3.2.1 | **None detected by the completed automated/static regression suite.** |

## Release rule
A future change must be added to this audit. Before release, the full accumulated audit is rerun. A previously working item that fails becomes ⚫ until repaired and retested.
