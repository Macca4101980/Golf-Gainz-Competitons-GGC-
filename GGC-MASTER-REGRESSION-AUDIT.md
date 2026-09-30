# GGC Master Regression Audit — Build 3.4 Individual Formats

Status: 🔵 current-build change tested · 🟢 prior behaviour regression-tested · 🟠 requires deployed/live test · 🔴 current failure · ⚫ regression.

## Build 3.4 changes
- 🔵 IND-FMT-001 — Individual category contains Stableford, Nett Stroke/Medal, Gross Stroke, Par/Bogey, Maximum Score and Singles Match Play.
- 🔵 HCAP-ALLOW-001 — Format defaults: 95% for individual handicap stroke-play formats, 100% Singles Match Play, 0% Gross Stroke. Competition creator can override 0–100% where applicable.
- 🔵 HCAP-PLUS-001 — allowance calculation moves plus Playing Handicaps towards zero; plus strokes are given back beginning at SI 18, then SI 17, etc.
- 🔵 HCAP-SNAPSHOT-001 — cards retain Course Handicap and Playing Handicap snapshots once scoring begins.
- 🔵 SCORE-STABLE-001 — Stableford known-answer test pack calculates hole strokes and points.
- 🔵 SCORE-NETT-001 — Nett Stroke known-answer test pack calculates nett totals.
- 🔵 SCORE-GROSS-001 — Gross Stroke ignores handicap and ranks gross total.
- 🔵 SCORE-PAR-001 — Par/Bogey calculates W/H/L against nett par and ranks final +/-.
- 🔵 SCORE-MAX-001 — Maximum Score supports fixed cap, double par and net double bogey; known-answer cap test passes.
- 🔵 SCORE-MATCH-001 — Singles Match Play is restricted to two golfers, uses 100% default allowance, low Playing Handicap plays from zero, opponent receives the difference, and match ends when mathematically clinched.
- 🔵 SCORE-EDIT-001 — changing format, handicap allowance, holes or Maximum Score setup after scoring begins warns and resets scorecards only after confirmation.
- 🔵 TESTPACK-IND-001 — deterministic 8-golfer Individual Formats JSON pack included; includes a +2.4 golfer (stored internally as -2.4).
- 🟠 LIVE-IND-001 — deployed scorecards/leaderboards/OOM to be checked against expected-results JSON/screenshots.

## Regression checks retained
- 🟢 GROUP-ROLE-001 — owner/admin/member role UI paths retained.
- 🟢 GROUP-OWNER-001/002 — owner transfer/leave protection and ownerless Take Ownership paths retained.
- 🟢 GROUP-DELETE-001/002 — delete warning and sole-owner delete paths retained in source; sole-owner deletion was live-confirmed in 3.2.5.2.
- 🟢 PLAYED-WITH-001/002/003 — Played With derives from shared competition participation and existing contact handling remains.
- 🟢 OOM-UI-001 — multi-Group OOM rendering retained.
- 🟢 OOM-BANDS-001 — 0–4 no points; 5–8 first=10; 9–12 first=12; 13–16 first=14.
- 🟢 BLIND-PAIRS-LEGACY-001 — historical array and `{ids:[...]}` pair shapes remain accepted.
- 🟢 COMP-LIFECYCLE-001 — Draft/Scheduled/Live/Completed/Cancelled lifecycle paths retained.
- 🟢 REALTIME-001 — remote-state echo guard retained.
- 🟢 PWA-SW-001 — service-worker update code retained; in-app prompt remains 🟠 for later investigation by prior agreement.
- 🟠 AUTH/PASSKEY — requires live Supabase/device testing.
- 🔴 MONEY-SETTLEMENT — complete prize-money settlement engine remains outside this build.
- 🔴 SIMULTANEOUS-SCORING — whole-state cloud blob concurrency remains; planned normalized-data build.
- ⚫ New regressions detected by automated/static audit: none.

## Automated evidence
- 42/42 individual scoring + retained helper assertions PASS.
- 28/28 static accumulated regression checks PASS.
- `src/scoring.js` JavaScript syntax check PASS.
- Production Vite compile not executed locally because dependency installation timed out; Vercel deployment remains the production compile test.

## Build 3.4.0 — Individual Competition Formats

Status rule: BLUE = changed this build and tested successfully; GREEN = unchanged and regression-tested; AMBER = requires deployed/live testing; RED = broken; BLACK = regression.

### Automated / static checks
- 🔵 IND-FMT-001 — Nine agreed Individual formats are available in Create Competition.
- 🔵 IND-SCORE-001 — Stableford known-answer scoring passed.
- 🔵 IND-SCORE-002 — Nett Medal known-answer scoring passed.
- 🔵 IND-SCORE-003 — Gross Stroke known-answer scoring passed.
- 🔵 IND-SCORE-004 — Par/Bogey known-answer scoring passed.
- 🔵 IND-SCORE-005 — Maximum Score fixed-cap known-answer scoring passed.
- 🔵 IND-SCORE-006 — Modified Stableford configurable-table engine passed.
- 🔵 IND-SCORE-007 — Flag progress ranking engine passed.
- 🔵 IND-SCORE-008 — Eclectic best-hole aggregation passed.
- 🔵 IND-SCORE-009 — Waltz x1/x2/x3 engine passed.
- 🔵 HCAP-PLUS-001 — +2.4 / 95% rounds Playing Handicap toward zero to +2.
- 🔵 HCAP-PLUS-002 — plus handicap gives back first stroke at SI18, not SI1.
- 🟢 GROUP-DELETE-STATIC — Build remains based on 3.2.5.2 group lifecycle/deletion correction lineage.
- 🟢 OOM-STATIC — Existing multi-Group OOM code path retained.
- 🟢 REALTIME-STATIC — Existing realtime guard/cloud persistence code retained.

### Live/deployed checks still required
- 🟠 IND-LIVE-001 — Create/open/score/submit each of the nine formats on deployed app.
- 🟠 IND-LIVE-002 — Override handicap allowance and confirm PH/leaderboard on device.
- 🟠 IND-LIVE-003 — Maximum Score fixed/double-par/net-double-bogey UI.
- 🟠 IND-LIVE-004 — Modified Stableford points editing and leaderboard.
- 🟠 IND-LIVE-005 — Flag finish entry and ordering.
- 🟠 IND-LIVE-006 — Eclectic round switching/persistence/best-hole leaderboard.
- 🟠 IND-LIVE-007 — Waltz multiplier display and totals.
- 🟠 OOM-LIVE-001 — Complete each format and verify OOM award and Group isolation.
- 🟠 CLOUD-LIVE-001 — Two-device Supabase save/reload/edit behaviour.
- 🟠 PWA-UPDATE-001 — Update prompt remains parked by user request.

No item is marked GREEN solely from code inspection; live-only behaviours remain AMBER.

## Build 3.4.1 — Pairs formats
- 🔵 PAIR-ENGINE-001 4BBB Stableford pair engine known-answer test.
- 🔵 PAIR-ENGINE-002 4BBB Stroke pair engine known-answer test.
- 🔵 PAIR-ENGINE-003 Aggregate Stableford pair engine known-answer test.
- 🔵 PAIR-ENGINE-004 Aggregate Stroke pair engine known-answer test.
- 🔵 PAIR-ENGINE-005 4BBB Match Play relative-handicap engine static/known-answer test.
- 🟠 PAIR-LIVE-001 Pair creation/removal/persistence in Manage Competition.
- 🟠 PAIR-LIVE-002 4BBB Stableford live cards and leaderboard.
- 🟠 PAIR-LIVE-003 4BBB Stroke live cards and leaderboard.
- 🟠 PAIR-LIVE-004 Aggregate Stableford live cards and leaderboard.
- 🟠 PAIR-LIVE-005 Aggregate Stroke live cards and leaderboard.
- 🟠 PAIR-LIVE-006 4BBB Match Play exactly two pairs and live result.
- 🟠 PAIR-LIVE-007 Blind Pairs draw/reveal/persistence.
- 🟠 IND-REGRESSION-001 Re-run all nine Individual live known-answer tests on deployed 3.4.1.
- 🔵 OOM-PAIR-ENGINE-001 Pair OOM engine splits team points equally between partners; field-size band uses player count.
- 🟠 OOM-PAIR-LIVE-001 Verify pair OOM appears correctly after deployed competition completion.
- 🟠 CLOUD-PAIR-001 Verify pairings/cards persist across two devices.

Note: Green is not used for retained code paths without a real regression test. Unexercised deployed behaviours remain amber.


## Build 3.4.1.1 — Pairs test activation correction
- 🔵 BUILD-ID-001 — visible header identifies Build 3.4.1.1 (static verified).
- 🔵 PAIRS-TESTDATA-001 — activatable Pairs test data is packaged at `/pairs-test-data.json` and contains six Pairs competitions.
- 🟠 PAIRS-LIVE-001 — load Pairs Formats test pack on deployed app and confirm Group appears.
- 🟠 PAIRS-LIVE-002 — verify all six Pairs leaderboards against expected calculations.
- 🟠 IND-REGRESSION-001 — reload Individual test pack and confirm prior nine-format results remain unchanged.

## Build 3.5.0 — Universal Live Group Scorecard
- 🔵 Visible build label and package version updated to 3.5.0.
- 🔵 4BBB Match Play renamed to Pairs Matchplay in competition format and leaderboard UI.
- 🔵 Universal round start supports selecting 1–4 golfers; one scorer can enter every selected golfer's card.
- 🔵 Scorecard changed to holes as rows and golfers as columns, with +/- score controls and handicap-shot dots.
- 🔵 Pairs formats visually group columns into Pair 1 / Pair 2 and persist explicit pair membership.
- 🔵 Starting a group round immediately creates an in-progress card for every selected golfer, so the shared round can appear for each participant.
- 🔵 Dashboard ROUND IN PROGRESS is now derived from an unsubmitted player card, not only the local device's active competition.
- 🔵 Submitted player rounds are removed from the Home dashboard while remaining available under Competitions.
- 🔵 Group submission submits all selected participant cards together and records the scorer in the audit trail.
- 🔵 Live edits record player, hole, before/after score and scorer; cloud state remains the shared source for other devices.
- 🔵 Pairs Matchplay uses 90% of Course Handicap difference from the lowest player and displays match-relative shot dots.
- 🔵 Pairs Matchplay detects a mathematically decided match and offers SAVE ROUND & EXIT or CONTINUE PLAYING.
- 🟠 Live Supabase multi-device test required: two scorers editing the same group round, dashboard propagation, refresh persistence and conflict behaviour.
- 🟠 Mobile test required: four-column scorecard horizontal scrolling, shot dots and touch targets.
- 🟠 Create Competition field-retention regression should be rechecked during live testing.

## Build 3.5.1 — Realtime State Protection
- 🔵 Create Competition draft is persisted independently in local storage while the form is open, so a component remount, realtime state refresh or page/PWA refresh cannot silently erase entered fields.
- 🔵 Intentional close discards the unsaved competition draft; successful Create Competition clears it after committing the competition.
- 🔵 Realtime cloud refresh now merges live scorecards by per-card `updatedAt` / `submittedAt` instead of replacing the entire local cards array.
- 🔵 Realtime merge preserves audit records, competition entrants and round-group membership from both local and remote state.
- 🔵 Visible build label, package version and service-worker cache updated to 3.5.1.
- 🟠 Live Supabase multi-device test required: half-fill Create Competition and leave open through repeated realtime events; confirm every field remains unchanged.
- 🟠 Live Supabase multi-device test required: enter scores on two devices in the same group round and confirm newer card edits survive incoming cloud refreshes.

## Build 3.5.2 — Compact Group Scorecard
- 🔵 Four-player scorecard compacted to fit a phone viewport without horizontal scrolling.
- 🔵 Explicit Team A / Team B spanning headers added to paired formats.
- 🔵 Pairs Matchplay live status strip added above card (AS / pair N UP, holes thru).
- 🔵 Match-shot dots retained with compact +/- controls.
- 🔵 Visible score-screen version and service-worker cache updated to 3.5.2.
- 🟠 Live iPhone/PWA test required for four-column fit, tap targets, team grouping and match status progression.

## Build 3.6.0 — Guests, Group Rename, Results Payouts & 2s Club on 3.5.2 lineage

### Changed/fixed this build
- 🔵 BUILD-ID-003 — visible header, score screen, package and PWA cache identify Build 3.6.0.
- 🔵 GROUP-RENAME-001 — Group Owner/Admin can rename a Group without changing its ID; competitions/cards remain related by Group ID and the rename is audited.
- 🔵 GUEST-001 — competition manager can add a competition-only Guest Golfer with name + Handicap Index.
- 🔵 GUEST-002 — guests can be selected on the universal 1–4 golfer group scorecard and scored normally.
- 🔵 GUEST-003 — guests are excluded from Order of Merit and Played With history.
- 🔵 GUEST-004 — guests remain visible in competition results and are labelled Guest.
- 🔵 MONEY-001 — main prize pot uses competition fee × actual entrant count.
- 🔵 MONEY-002 — completed results display configured overall 1st/2nd/3rd payouts.
- 🔵 MONEY-003 — pair payouts show team prize and per-player share.
- 🔵 MONEY-004 — configured Front 9 / Back 9 side pots calculate from entrant-funded pot and tied winners split equally.
- 🔵 TWOS-001 — competition setup includes 2s Club toggle and £ per golfer.
- 🔵 TWOS-002 — 2s pot uses 2s fee × actual entrant count, including guests.
- 🔵 TWOS-003 — every gross 2 earns one equal share; multiple 2s by one golfer earn multiple shares.
- 🔵 TWOS-004 — completed results show golfer, hole(s), winnings, and an unclaimed pot when there are no 2s.

### Full accumulated automated/static regression rerun
- 🟢 IND-SCORE-001..009 — all nine Individual known-answer scoring tests passed.
- 🟢 PAIR-SCORE-001..006 — 4BBB Stableford, 4BBB Stroke, Aggregate Stableford, Aggregate Stroke, Pairs Matchplay and Blind Pairs known-answer tests passed.
- 🟢 REALTIME-STATIC — 3.5.1 `mergeLiveState` card/audit/entrant/round-group protection retained.
- 🟢 COMP-DRAFT-STATIC — 3.5.1 Create Competition local draft protection retained and extended to 2s Club fields.
- 🟢 GROUP-CARD-STATIC — 3.5.x universal 1–4 golfer scorecard retained.
- 🟢 DASHBOARD-STATIC — submitted-card dashboard filtering retained.
- 🟢 TEAM-HEADER-STATIC — Team A / Team B compact pair headers retained.
- 🟢 ROUND-GROUP-STATIC — round-group persistence retained.
- 🟢 GROUP-AUDIT-STATIC — live group score edit/submit audit paths retained.
- 🟢 PWA-UPDATE-STATIC — safe update banner retained; service-worker cache advanced to 3.6.0.
- ⚫ New automated/static regressions detected: none.

Automated/static result for Build 3.6.0: **39 passed, 0 failed**.

### Live/deployed checks still required
- 🟠 GROUP-RENAME-LIVE-001 — rename a deployed Group and verify competitions/cards remain attached after reload on another device.
- 🟠 GUEST-LIVE-001 — add guests, include them in a 1–4 golfer live group card, submit, reload and verify persistence.
- 🟠 GUEST-LIVE-002 — confirm guests never appear in Played With or OOM on deployed data.
- 🟠 MONEY-LIVE-001 — complete a competition and verify displayed 1st/2nd/3rd and Front/Back 9 payouts against the configured fee/split.
- 🟠 TWOS-LIVE-001 — record multiple gross 2s, including two by one golfer, and verify the completed-results split.
- 🟠 REALTIME-LIVE-001 — two-device simultaneous scoring/realtime merge test remains required.
- 🟠 COMPDRAFT-LIVE-001 — leave Create Competition open through realtime events/PWA refresh and verify all fields, including 2s Club, survive.
- 🟠 MOBILE-LIVE-001 — iPhone/PWA four-player compact scorecard, Team A/B headers and Pairs Matchplay strip remain device checks.
- 🟠 PROD-COMPILE-001 — local dependency installation exceeded the execution window, so the Vite production compile was not completed here; deployment compile remains required.


## Build 3.8.0 — Placeholder golfers, claim links & League teams
- 🔵 Admin can create a named placeholder golfer inside a League before that golfer has a GGC account.
- 🔵 Placeholder is immediately added to the Group and League and can be used in team setup.
- 🔵 Placeholder has a private single-use-style claim token and WhatsApp/native share flow.
- 🔵 Claim signup inherits the placeholder name and asks the golfer to confirm Handicap Index.
- 🔵 Claim remaps Group, League, League-team, competition, pair/group-card and scorecard references to the authenticated GGC player ID rather than creating a duplicate golfer.
- 🔵 League teams support two golfers, a team name and a selectable badge.
- 🔵 League competition setup inherits the League name; the duplicate editable Competition base name field is removed in League batch mode.
- 🟠 Live multi-device claim flow requires production testing with two separate authenticated accounts.
- 🟠 League team badges and placeholder pairing require production mobile UI testing.


## Build 3.8.1 — Placeholder golfer maintenance
- 🔵 Placeholder golfers can be renamed after creation.
- 🔵 Placeholder golfers can be deleted after confirmation.
- 🔵 Deleting a placeholder cleans its Group/League membership, League team assignment, competition entry/invite/pair references, scorecards and contact references so an orphan placeholder is not left behind.
- 🟠 Production mobile UI and cloud-sync deletion require live testing.


## Build 3.8.2 — Unified unclaimed golfers
- 🔵 League placeholder creation now requires Name + Handicap Index.
- 🔵 Competition Guest creation now creates the same claimable Unclaimed Golfer type rather than a competition-only guest.
- 🔵 Unclaimed golfers created from a Competition are added to the owning Group and can be shared a private claim invite.
- 🔵 Existing legacy guest/placeholder records are recognised as unclaimed golfers for compatibility.
- 🔵 Claiming an unclaimed golfer preserves their existing player references/history and converts them into a normal GGC member.
- 🔵 League unclaimed golfers display and allow editing of Handicap Index.
- 🟠 Full production regression of legacy Guest records and multi-account claiming requires live testing.
