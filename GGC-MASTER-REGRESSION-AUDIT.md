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

## Build 3.2.4 — Safe PWA Updates

| Status | Area | Result |
|---|---|---|
| 🔵 | PWA-UPDATE-001 detection | Checks for a new service worker on app focus, foreground return and every 30 minutes. |
| 🔵 | PWA-UPDATE-001 safe activation | New worker waits; GGC does **not** auto-reload while a golfer may be scoring. |
| 🔵 | PWA-UPDATE-001 prompt | UPDATE NOW activates the waiting build and reloads; LATER leaves the current session running. |
| 🟢 | 3.2.3 multi-Group OOM code | Retained; existing OOM engine preserved. |
| 🟢 | 3.2.3 multi-Group Competitions code | Retained. |
| 🟢 | 3.2.3 Show/Hide filter code | Retained. |
| 🟢 | Stableford / Nett Stroke / Gross Stroke / Par-Bogey | Deterministic 8-player regression passed again. |
| 🟢 | Blind Pairs / OOM bands / plus handicaps | Deterministic regression passed again. |
| 🟢 | Realtime echo guard / closed scoring guard | Retained. |
| 🟠 | PWA update on real iPhone | Must be proven with 3.2.4 installed and a later deployment available. |
| 🟠 | Update while a card is in progress | Live test: ignore prompt → continue/submit card → update afterwards. |
| 🟠 | Production Vite compile | Vercel remains the production compile/deploy check. |
| 🔴 | Prize-money settlement engine | Existing known incomplete area; unchanged. |
| ⚫ | New regressions detected by 3.2.4 automated/static suite | None detected. |

## Permanent release rule
Every new behaviour is added here and the full accumulated regression suite is rerun. Any previously working behaviour that fails becomes ⚫ until fixed and retested.

## Build 3.2.5 — Group Ownership + Competition Lifecycle

| Status | Area | Result |
|---|---|---|
| 🔵 | GROUP-ROLE-001 | Group member cards render OWNER / ADMIN / MEMBER from stored IDs; invalid/missing owner is not falsely labelled Owner. Static regression passed. |
| 🔵 | GROUP-OWNER-001 | Owner cannot Leave and Owner cannot be removed; ownership must be transferred first. Static regression passed. |
| 🔵 | GROUP-OWNER-002 | A genuinely ownerless/invalid-owner legacy Group offers TAKE OWNERSHIP to any authenticated current member; claim persists immediately. Static regression passed. |
| 🔵 | GROUP-DELETE-001 | Owner pressing Delete while other members remain receives the agreed warning and deletion is blocked. Sole-member Owner retains normal destructive confirmation. Static regression passed. |
| 🔵 | COMP-LIFECYCLE-001 | New competitions can be Draft, Start Now, or Scheduled. Draft scoring is locked. Static transition tests passed. |
| 🔵 | COMP-LIFECYCLE-002 | Scheduled status derives from timestamps: before start = Scheduled, start→end = Live, after end = Completed. Deterministic transition tests passed. |
| 🔵 | COMP-LIFECYCLE-003 | Duration starts from actual/scheduled launch, not creation time. 1/2/3/7-day and Custom duration supported. Static regression passed. |
| 🔵 | COMP-LIFECYCLE-004 | GO LIVE NOW resets the competition start to now and its end to now + configured duration. Static regression passed. |
| 🔵 | COMP-LIFECYCLE-005 | Effective Completed status closes score editing/submission and is eligible for OOM calculation. Static regression passed. |
| 🟢 | Stableford / Nett Stroke / Gross Stroke / Par-Bogey | Deterministic scoring regression passed again. |
| 🟢 | Blind Pairs historical shapes | Array and `{ids:[...]}` compatibility regression passed again. |
| 🟢 | OOM field-size bands | 5–8 / 9–12 / 13–16 bands regression passed again. |
| 🟢 | Plus handicaps | Signed plus-handicap maths regression passed again. |
| 🟢 | Multi-Group OOM / Competitions | Existing 3.2.3 paths retained by static regression. |
| 🟢 | Realtime echo guard | Existing 3.13.7 guard retained. |
| 🟢 | PWA safe update system | 3.2.4 waiting-worker / UPDATE NOW mechanism retained; cache advanced to 3.2.5. |
| 🟠 | GROUP-OWNER live cloud race | Claim ownership should be tested on deployed app; whole-state simultaneous-write limitation remains until 3.3. |
| 🟠 | Scheduled auto-launch on deployed iPhone | Verify a short future schedule changes Scheduled → Live without app restart and later closes. |
| 🟠 | PWA 3.2.4 → 3.2.5 update | This deployment is the first real opportunity to prove UPDATE NOW / LATER on iPhone. |
| 🟠 | Production Vite compile | JSX syntax transpile passed locally; Vercel remains the production Vite compile/deploy check. |
| 🔴 | Prize-money settlement engine | Existing known incomplete area; unchanged and outside 3.2.5. |
| 🟠 | Simultaneous scoring | Existing whole-state last-write-wins limitation; deliberately deferred to Build 3.3 normalized data. |
| ⚫ | New regressions detected by 3.2.5 automated/static suite | None detected. |

## Build 3.2.5.1 — Live-Test Corrections

| Status | Area | Result |
|---|---|---|
| 🔴 | 3.2.5 GROUP-DELETE-002 live test | Failed: Group detail showed 1 valid member but Group list/Delete still counted a stale/ghost member ID. Captured from live iPhone test. |
| 🔵 | GROUP-DELETE-002 correction | Member counts and Delete eligibility now use valid member IDs that resolve to real golfer records. Synthetic ghost-member regression passed. |
| 🔵 | PLAYED-WITH-001 correction | Played With now derives golfers from shared competition entries as well as saved contacts. Synthetic shared-competition regression passed. |
| 🔵 | PLAYED-WITH-002 removal behaviour | Removed Played With golfers are suppressed via `hiddenContacts`; playing together again clears the suppression. Static regression passed. |
| 🔵 | ME-UX-001 | Duplicate CREATE / JOIN GROUP action removed from Me; Groups retains the single Create / Join action. Static regression passed. |
| 🟢 | GROUP-ROLE-001 / OWNER-001 / OWNER-002 | Ownership labels, Take Ownership, Owner leave protection and Owner removal protection retained in source regression. |
| 🟢 | GROUP-DELETE-001 | Multi-member delete warning and block retained. |
| 🟢 | Competition lifecycle | Draft / Scheduled / Live / Completed logic and Start Now / Schedule paths retained. |
| 🟢 | Scoring/helper suite | 44 deterministic scoring/helper checks passed, including test-pack cards, OOM bands and Blind Pairs historical pair shapes. |
| 🟢 | Multi-Group OOM / Realtime guard / PWA update | Existing paths retained by static regression. |
| 🟠 | GROUP-DELETE-002 deployed iPhone | Needs live confirmation that the current sole-member Group shows 1 everywhere and can be deleted. |
| 🟠 | PLAYED-WITH-001 deployed data | Needs live confirmation against the user's existing competition history. |
| 🟠 | Production Vite compile | npm dependency install timed out in the build environment; Vercel remains the production compile/deploy check. |
| 🔴 | Prize-money settlement engine | Existing known incomplete area; unchanged. |
| 🟠 | Simultaneous scoring | Existing whole-state limitation; deliberately deferred to Build 3.3 normalized data. |
| ⚫ | New regressions detected in 3.2.5.1 automated/static suite | None detected. |
