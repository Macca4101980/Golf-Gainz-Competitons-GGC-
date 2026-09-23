# GGC Master Regression Audit

## Status key
- 🔵 changed/fixed in this build and tested successfully
- 🟢 previously working, unchanged, regression-tested and still passes
- 🟠 untested / requires deployed or multi-device testing
- 🔴 currently broken
- ⚫ regression: previously working but a build broke it

## Build 3.2.3 — Multi-Group Views

| Status | Area | Result |
|---|---|---|
| 🔵 | OOM multi-Group view | OOM renders every shown Group independently. The working 3.2.2 OOM engine is byte-for-byte unchanged. |
| 🔵 | Competitions multi-Group view | Competitions from all shown member Groups are grouped under their Group heading. |
| 🔵 | Home live competitions | Live competitions aggregate across all shown Groups. |
| 🔵 | Home Group sharing | Each shown Group has its own Share action. |
| 🔵 | Me → My Groups filter | SHOWING/HIDDEN controls affect display only; they do not leave or delete membership. |
| 🟢 | OOM crash protection | User live-tested 3.2.2: OOM no longer crashes. The calculation/render engine is unchanged here. |
| 🟢 | Existing selected-Group OOM calculation | Exact 3.2.2 working calculation path retained and reused once per shown Group. |
| 🟢 | Stableford | Deterministic 8-player regression passed. |
| 🟢 | Nett Stroke | Deterministic 8-player regression passed. |
| 🟢 | Gross Stroke | Deterministic 8-player regression passed. |
| 🟢 | Par/Bogey | Deterministic 8-player regression passed. |
| 🟢 | Blind Pairs compatibility | Historical array and object pair helpers passed. |
| 🟢 | OOM field-size points | Regression passed. |
| 🟢 | Plus handicaps | Signed plus-HI regression passed. |
| 🟢 | Competition Group assignment | Existing Group selector retained. |
| 🟢 | Closed competition scoring guard | Retained. |
| 🟢 | Realtime echo guard | Retained. |
| 🟢 | Group leave persistence code | Retained. |
| 🟠 | Multi-Group OOM live | Verify two or more Groups appear and calculate independently after deploy. |
| 🟠 | Multi-Group Competitions live | Verify correct Group headings/cards after deploy. |
| 🟠 | Home Group Share live | Verify each Share action sends the intended Group code. |
| 🟠 | Show/Hide persistence | Verify PWA reload. In 3.2.3 this preference is device-local, not membership data. |
| 🟠 | Full create-to-OOM journey | Live test Group selection → create → score → leaderboard → complete → correct Group OOM. |
| 🟠 | Auth / OTP / Passkey | Requires deployed device testing. |
| 🟠 | Multi-device Realtime | Requires two devices. |
| 🟠 | Simultaneous scoring | Known whole-state last-write-wins limitation; unchanged. |
| 🔴 | Prize-money settlement engine | Still incomplete; outside this build. |
| ⚫ | New regressions detected in automated/static suite | None detected. |
| 🟠 | Production compile | Local Vite compile unavailable because dependencies are not installed; Vercel is the production compile test. |

## Permanent release rule
Every new behaviour is added here and the full accumulated regression suite is rerun. Any previously working behaviour that fails becomes ⚫ until fixed and retested.
