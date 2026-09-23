# GGC Master Regression Audit

## Status key
- 🔵 **BLUE** — changed/fixed in this build and tested successfully.
- 🟢 **GREEN** — previously working, unchanged, regression-tested and still passes.
- 🟠 **AMBER** — not yet live-tested or depends on the deployed Supabase/device environment.
- 🔴 **RED** — currently broken/current failure.
- ⚫ **BLACK** — regression: previously working but a build broke it.

## Build 3.2.2 — OOM Regression Fix

| Status | Area | Audit result |
|---|---|---|
| ⚫ | OOM in Build 3.2.1 | **FAILED LIVE TEST.** The prior helper-only regression test was insufficient to certify the complete OOM screen. This historical failure remains recorded. |
| 🔵 | OOM defensive calculation | Missing arrays, malformed scorecards, malformed competitions, missing players/names and historical pair shapes are handled without taking down the page. Source-path and helper regression checks pass. |
| 🔵 | OOM historical Blind Pairs | Both pair arrays and `{ids, score}` records are accepted; malformed pairs are ignored. |
| 🔵 | OOM empty/error rendering | OOM now has explicit safe empty/error rendering instead of allowing a calculation exception to blank the application. |
| 🟠 | OOM deployed screen | **Must remain amber until the deployed 3.2.2 OOM page is opened against the user's real Supabase data.** It cannot be marked green/blue from local helper tests alone. |
| 🟢 | Stableford | Deterministic regression still returns 31, 33, 38, 40, 35, 34, 31, 32. |
| 🟢 | Nett Stroke Play | Deterministic regression still returns 77, 75, 70, 68, 73, 74, 77, 76. |
| 🟢 | Gross Stroke Play | Deterministic regression still returns 73, 73, 74, 76, 86, 93, 103, 115. |
| 🟢 | Par / Bogey | Deterministic regression still returns -4, -3, +1, +3, -1, -2, -4, -4. |
| 🟢 | OOM points bands | Under 5 = none; 5–8 = 10 first; 9–12 = 12; 13–16 = 14; 17+ = 16. |
| 🟢 | Plus handicaps | Signed plus-HI and negative hole-stroke tests still pass. |
| 🟢 | Blank score controls | Blank `+` = Par; blank `−` = Birdie. |
| 🟢 | Realtime echo guard | `remoteStateRef` protection retained. |
| 🟢 | Closed competition scoring guard | 3.2.1 lifecycle guard retained. |
| 🟢 | Group immediate-save code | Leave/member/admin/ownership persistence code retained; no OOM fix touched these areas. |
| 🟠 | Group multi-device live tests | Still require deployed two-account/device regression. |
| 🟠 | Auth / OTP / passkey | Requires deployed device tests. |
| 🟠 | Global Courses | Requires cross-account live regression. |
| 🟠 | Simultaneous live scoring | Known whole-state last-write-wins limitation; not changed in this OOM fix. |
| 🔴 | Prize-money settlement engine | Still incomplete; not part of 3.2.2. |
| ⚫ | New regressions detected by 3.2.2 automated/static suite | **None detected.** |

## Release rule
Every future change is added here and the full accumulated regression suite is rerun. A previously working item that fails becomes ⚫ until repaired and retested.
