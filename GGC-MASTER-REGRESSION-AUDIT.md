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
