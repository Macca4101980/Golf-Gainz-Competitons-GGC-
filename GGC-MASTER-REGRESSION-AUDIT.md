# V4 Beta 10 — explicit competition closing times (23 October 2026)

- 🔵 Closing-time regression: Week 1 stays live until 18:00 UK and closes at the exact boundary.
- 🔵 Schedule editor saves the explicit deadline; unrelated name/fee/scoring edits preserve it.
- 🔵 New League weeks default to 18:00 on their final calendar day; admins can override the deadline.
- 🔵 Calendar arithmetic covers UK spring/autumn DST, batch weeks, date cascades and custom deadline shifts.
- 🔵 Manual completed status is consistent in the League schedule.
- 🟢 All 182 automated tests pass, including scoring, Winter League, record saving, identity and deletion coverage. Production build passes.
- 🟠 Authenticated browser/iPhone schedule save-and-reopen and PWA upgrade have not been exercised in this session.
- 🟠 Existing production dates (apart from the earlier Week 1 data repair) are not migrated by this code change.
- 🟠 No new PostgreSQL migration; production rollback and multi-user integration rehearsals not rerun for this UI/scheduling change.
- Base: verified current production commit d793aa45a66b3866fccb1f1bd46faa30a7225a0c.

---

# V4 Beta 1 — Consolidation & Full Regression

Status: 🔵 changed/tested this build · 🟢 retained and regression-tested · 🟠 requires live/device verification · 🔴 broken/missing · ⚫ regression.

## V4 Beta 1 scope / current audit
- 🔵 BUILD-V4B1 — visible/package build identity moved to V4 Beta 1 / 4.0.0-beta.1.
- 🔵 GOLF-GAIN-001 — Golf Gain companion App Store card added using the supplied icon and App Store destination.
- 🔵 HCAP-PLUS-ENTRY — signup, Group Add Golfer and Group Manage Golfer accept golf notation such as +5 and store it internally as -5; display remains +5.0.
- 🟢 HCAP-PLUS-SCORE — scoring engine remains separate from the input fix; existing regression covers plus Playing Handicap giving strokes back from SI18.
- 🟢 GROUP-DELETE — deleted Group tombstones are retained and filtered during live merge so stale state cannot re-add a deleted Group.
- 🟢 MONEY-LEAGUE-STATIC — League Money manager exists: entry fee, 2s contribution, weekly prize, final split, paid-in, paid-out, owed, rollover and bank reconciliation.
- 🟢 MONEY-COMP-STATIC — competition overall/side-pot/2s calculation lineage retained from 3.6.0.
- 🟠 MONEY-LIVE — complete real League/competition settlement needs live verification against actual completed results and reload.
- 🟠 JOIN-CODE-LIVE — separate-account Join With Code journey still requires live verification.
- 🟠 INVITE-CLAIM-LIVE — email/share invite, claim, cross-Group identity linking and claimed-status journey requires live multi-account verification.
- 🟠 WL-25/26-LIVE — historical season/results/playoff presentation requires final deployed comparison.
- 🟠 WL-26/27-LIVE — current 10-week League, team cuts, Best-X and week-by-week handicap display require deployed comparison.
- 🟠 RESULTS-OOM-LIVE — Results/OOM presentation and Group isolation require deployed completion checks.
- 🟠 BADGE-LIVE — repeated upload/replace/remove/reload requires authenticated iPhone/Supabase verification.
- 🟠 PWA-UPDATE-LIVE — safe update banner code exists; old-PWA-to-new-build update journey requires device verification.
- 🟠 MOBILE-LIVE — compact group card and League/settings layouts require iPhone verification.
- 🔴 SIMULTANEOUS-SCORING — shared whole-state ggc_state blob remains an architectural concurrency risk; do not mark verified until normalized/conflict-safe persistence is implemented or proven safe.
- 🟢 V4 automated regression gate — GitHub Actions final branch run 137: npm test PASS and npm run build PASS; Vercel preview deployment PASS.
- 🔵 HCAP-ZERO-001 — full regression exposed negative-zero on a plus-handicap hole with no give-back stroke; normalized to ordinary 0 and rerun successfully.
- ⚫ V4 regressions detected after fixes: none in automated suite.

## Required V4 Beta 1 regression gate
1. Run every repository node:test regression, including Individual, Pairs, Group Formats, Winter League, identity, invites, deletion and + handicap tests.
2. Vercel preview must compile/deploy successfully.
3. Any changed behaviour must have a dedicated regression assertion.
4. No production promotion while a newly introduced automated regression is failing.
5. Live-only items remain 🟠 rather than being incorrectly marked green.


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


## Build 3.8.3 — Add Golfer black-screen hotfix
- 🔵 Fixed League Add Golfer render crash caused by calling an undefined Handicap Index formatter immediately after the new golfer was added.
- 🟠 Re-test Add Golfer on deployed mobile build and verify golfer persists after reload.


## Build 3.8.4 — Temporary Winter League roster bootstrap
- 🔵 Added temporary IMPORT 26/27 WINTER LEAGUE ROSTER control beside the regression test-pack controls.
- 🔵 Imports the GitHub roster into the currently selected Group as 30 unclaimed golfers and 15 League teams.
- 🔵 Import is idempotent by stable golfer/team IDs and a League bootstrap key, so rerunning updates the roster instead of duplicating it.
- 🔵 Existing claim tokens/account links and any existing uploaded badgeImage values are preserved when the bootstrap is rerun.
- 🟠 Production cloud import requires live testing before the temporary control is removed.


## Build 3.8.6 — League roster sync across all weeks
- 🔵 League members are carried into every newly created League week automatically.
- 🔵 Adding an unclaimed golfer from any linked League competition adds that golfer to the League roster and every existing linked week.
- 🔵 Adding/removing a golfer in League setup synchronises that golfer across all existing linked League competitions.
- 🔵 Claiming an unclaimed golfer continues to remap the same identity across League membership, all competition entries, teams, pairs, groups and cards; one claim link is sufficient.
- 🔵 League team pairings are now passed into newly created weekly competitions rather than being discarded during batch creation.
- 🟠 Live-test an existing 10-week League after adding one golfer and claiming that profile from a second account/device.


## Build 3.9.0 — Winter League handicap + OOM engine
- 🔵 Winter League weekly score uses hole-by-hole Better Ball Stableford; one submitted partner card remains a valid team score.
- 🔵 Winter League scoring uses 90% Playing Handicap before Winter League reductions.
- 🔵 Team handicap reduction triggers at 37 points: 37 = 0.5, 38 = 1.0, 39 = 1.5 and continues by 0.5 per point, applied equally to both partners and carried forward only downward.
- 🔵 Cancelled League competitions are excluded from handicap progression and OOM calculations.
- 🔵 Overall Winter League table uses best 8 counting scores by default and recalculates from submitted cards.
- 🔵 Weekly ties use last 9, 6, 3, 1 Better Ball point countback.
- 🔵 Overall ties use the last three counting cards, then last two, then last one.
- 🔵 League screen shows position, team/badge, played, counting scores, total points and current Winter League team reduction.
- 🔵 Weekly results panel shows top three and the handicap cut generated that week.
- 🟠 Requires live regression with known Winter League cards before marking the full 10-week season verified.


## Build 3.9.3 — Configurable League Handicap Management + badge storage
- 🔵 LEAGUE-HCAP-001 — League handicap mode is configurable: fixed, individual performance, team performance, or manual only.
- 🔵 LEAGUE-HCAP-002 — Starting allowance is League-owned and propagates to already-created linked competitions.
- 🔵 LEAGUE-HCAP-003 — Stableford target, cut per point, down-only vs up/down, and shots-back rate are configurable.
- 🔵 LEAGUE-HCAP-004 — Default/Winter League preset remains 90%, team score, target 36, 0.5 cut per point above target, reductions only.
- 🔵 LEAGUE-HCAP-005 — Handicap progression is recomputed in chronological week order from stored cards, so historical score/rule edits cascade forward.
- 🔵 LEAGUE-HCAP-006 — League adjustments are separate from normal GGC Handicap Index.
- 🔵 LEAGUE-HCAP-007 — Fractional League adjustments are accumulated, then effective Playing Handicap is WHS-rounded before hole stroke allocation.
- 🔵 LEAGUE-HCAP-008 — Automated rule tests cover 37/38/39 Winter League cuts, fixed/manual modes, down-only, up/down and legacy settings migration.
- 🔵 BADGE-STORAGE-001 — New/replaced team badges upload as image files to Supabase Storage; GGC state stores the image URL rather than Base64 payload.
- 🟠 BADGE-STORAGE-LIVE-001 — Supabase team-badges bucket/policies and authenticated upload/public read require staging verification before production.
- 🟠 LEAGUE-HCAP-LIVE-001 — Existing 10-week Winter League requires staging verification that settings and historical changes cascade through all linked competitions.
- 🟠 MOBILE-LIVE-393 — iPhone layout/touch regression required for Handicap Management controls.
- ⚫ New regressions detected: none at static implementation stage.


## Build 3.9.3 — Master Regression Rerun (2026-10-01)
- 🟢 BUILD-393-001 — package identifies 3.9.3.
- 🟢 BUILD-393-002 — GitHub production Vite build passed on commit e736472 after compile regressions were corrected.
- 🟢 LEAGUE-HCAP-AUTO-001 — automated handicap suite covers default rules, fixed/manual, down-only, up/down, legacy migration, team split, Net Level Par buffer and fractional accumulation.
- 🟢 SCORE-ENGINE-STATIC-001 — previously verified Individual scoring engine and Pairs scoring helpers remain present in src/scoring.js.
- 🟢 PAIR-MATCH-STATIC-001 — Pairs Matchplay relative-handicap and match-result helpers remain present.
- 🟢 WL-ENGINE-STATIC-001 — chronological League recomputation, Better Ball, one-partner valid scoring, countback and Best-X paths remain present.
- 🔵 OOM-MODE-001 — OOM engine now has position, cumulative Stableford, cumulative nett +/- par and matchplay result modes.
- 🔵 OOM-BESTX-001 — Best-X selection is high-to-low for points modes and low-to-high for nett +/- par.
- 🔵 OOM-TEAM-001 — pair/team position awards support split equally or full award to each golfer.
- 🔵 OOM-STATUS-001 — future competitions display UPCOMING; completed included competitions COUNTING; deliberately removed completed competitions EXCLUDED.
- 🟠 OOM-LIVE-393 — all four OOM modes require deployed known-result verification; matchplay storage shape especially requires live verification.
- 🟠 NAV-LIVE-393 — Home / Competitions / Groups / Results / Settings and top-right Me navigation require iPhone/PWA verification.
- 🟠 SETTINGS-LIVE-393 — Settings Group selector and Competition / League / OOM / Group & Access panels require live persistence verification.
- 🟠 CLOUD-LIVE-393 — cloud save/reload and realtime echo-loop regression require live verification.
- 🟠 WL-LIVE-393 — existing 26/27 10-week League, teams, badges, allowance and handicap settings require live verification.
- 🟠 BADGE-LIVE-393 — repeated replace/remove/re-upload and reload requires live verification; prior multi-upload iOS flow was user-confirmed functional.
- 🟠 COMP-LIVE-393 — create/edit/delete competition, card edit/submit and completed leaderboard require live verification.
- 🟠 GROUP-LIVE-393 — membership/invite/show-hide and persistence require live verification.
- 🟠 MONEY-LIVE-393 — prize / 2s settlement display remains live verification.
- 🟠 MOBILE-LIVE-393 — four-player scorecard fit, pair headers, matchplay strip and touch targets remain device verification.
- 🟠 AUTH-LIVE-393 — passkey/login/profile claim flows require authenticated multi-account live verification.
- 🔴 MONEY-SETTLEMENT — full settlement/owed/paid engine remains outside current build.
- 🔴 SIMULTANEOUS-SCORING — whole-state cloud blob concurrency remains a known architectural limitation; normalized-data build still required.
- ⚫ New static/automated regressions detected in this rerun: none after compile fixes.


## Build 3.9.4 — live regression repair batch
- 🔵 STATE-394-001 — authenticated app remains mounted during profile/token refresh so nested Settings/League UI is not discarded.
- 🔵 STATE-394-002 — Settings section and League editor context persist across remount/reload boundaries.
- 🔵 GROUP-394-001 — Start-group golfer draft persists in session storage until the group round is started/submitted.
- 🔵 CLOUD-394-001 — competition realtime merge now selects the newer competition base and unions entries/invites/round groups.
- 🔵 LEAGUE-394-001 — adding/removing a golfer to/from a League also adds/removes linked competition invites.
- 🔵 SCORECARD-394-001 — four-player card restores gross, nett in brackets, Stableford points and controls below the score.
- 🔵 SCORECARD-394-002 — player headers are sticky and entered scores have explicit high-contrast state.
- 🔵 SCORECARD-394-003 — birdie/eagle/bogey/double-bogey gross-score notation added.
- 🔵 NAV-394-001 — bottom navigation uses consistent Lucide icons and fixed icon dimensions.
- 🔵 COPY-394-001 — competition name placeholder changed to “Enter your competition name”.
- 🔵 BUILD-394-001 — scorecard and start-group build labels updated to 3.9.4.
- 🟠 LIVE-394-001 — iPhone regression required for Settings/League stay-in-place behaviour, badge picker return, group golfer persistence, sticky scorecard header and four-column fit.
- 🟠 INVITE-394-001 — second-account verification required that a newly added League golfer sees the linked competition invitation(s).
- 🟠 CLOUD-394-002 — second-device concurrent cloud verification remains required before production.


## Build 3.9.5 — historical League results repair
- 🔵 HIST-395-001 — completed historical League competitions render full team leaderboards without fabricated individual scorecards.
- 🔵 HIST-395-002 — Results recognises historical League Groups and renders League standings instead of an empty individual OOM.
- 🔵 HIST-395-003 — Results shows all completed historical competitions rather than only the three most recent.
- 🔵 WL-395-001 — weekly League results render every team rather than the top three only.
- 🔵 MOBILE-395-001 — League table replaced with phone-first rows; counting scores expand on tap and no horizontal table is required.
- 🔵 GROUPS-395-001 — duplicate League editor removed from the everyday Groups screen; administration remains in Settings → Leagues.
- 🔵 BUILD-395-001 — scorecard labels/package identify build 3.9.5.
- 🟠 LIVE-395-001 — production iPhone verification required for 25/26 Results, Week 1–10 leaderboards and mobile League rows.

### 3.9.5 cloud state safety gate
- 🔵 Automatic cloud writes are blocked until the authenticated client's first cloud hydration has completed.
- 🔵 Empty/default client state is write-protected and cannot replace the shared cloud state.
- 🟠 Live regression gate: fresh browser/session must load cloud before any save; auth refresh must preserve state; offline/empty startup must not overwrite cloud; second device must merge without data loss.


## Build 3.9.6 Beta.9 — Checkpoint 1: League flexibility & persistence
- 🔵 CP1-LEAGUE-TEAM-RENAME-001 — League team can be renamed without changing team ID, member IDs, badge, scores or history; linked competition pair display names update by the same team ID.
- 🔵 CP1-LEAGUE-LINK-001 — New/edit Competition exposes League: None / [League] for the selected Group.
- 🔵 CP1-LEAGUE-LINK-002 — Existing Competition can be linked to a League without recreating the Competition; linking inherits the League roster/team pair definitions and persistent League OOM settings.
- 🔵 CP1-LEAGUE-UNLINK-001 — Existing Competition can be removed from a League by selecting None without deleting the Competition or its scorecards/history.
- 🔵 CP1-LEAGUE-LENGTH-001 — League setup competition count is an initial creation quantity only; additional League competitions can always be added later.
- 🔵 CP1-LEAGUE-OOM-001 — League stores persistent OOM method, Best-X/counting and team-award rules; changes propagate to linked Competition metadata and later-linked competitions inherit the current rules.
- 🔵 CP1-WL-BESTX-001 — League Best-X drives the Winter League table when explicitly configured; Best-X 0 means all eligible rounds, while legacy Leagues with no League OOM setting retain their existing handicap-engine Best-X default.
- 🟢 CP1-AUTO-REGRESSION-001 — GitHub Node test suite and production Vite build complete successfully on the CP1 branch.
- 🟠 CP1-LIVE-001 — Live UI test still required: rename a real/test League team and confirm badge, members, historical cards and results remain attached.
- 🟠 CP1-LIVE-002 — Live UI test still required: attach/detach an existing Competition and verify League Results/OOM, cloud reload and scorecard history.
- 🟠 CP1-LIVE-003 — Live UI test still required: add an 11th competition to a 10-competition League and confirm persistent OOM/Best-X rules after cloud reload.


## Build 3.9.6 Beta.10 — Checkpoint 2: Golfer identity foundation
- 🔵 CP2-EMAIL-001 — Placeholder golfers support an optional normalized email address and it can be edited without recreating the golfer.
- 🔵 CP2-IDENTITY-001 — Authenticated identity consolidation uses the verified sign-in email; golfer names are never used as a merge key.
- 🔵 CP2-CROSSGROUP-001 — Placeholder IDs carrying the same verified email are consolidated across Groups/Leagues/competitions while references, cards and starting-handicap snapshots are migrated to the authenticated golfer ID.
- 🔵 CP2-DISPLAYNAME-001 — Claimed golfer display-name editing remains global because Groups, Leagues, cards and results reference the golfer ID rather than copied player names.
- 🔵 CP2-STATUS-001 — Placeholder membership status is explicit: NOT INVITED / INVITE SENT / GGC MEMBER. CP3 will move a golfer to INVITE SENT when the new invitation workflow is issued.
- 🟠 CP2-LIVE-001 — Live test required: add an email to an existing placeholder and confirm its ID, teams, badges, cards and League history do not change.
- 🟠 CP2-LIVE-002 — Live test required: same email on placeholders in multiple Groups, then authenticated claim, confirming one member identity and preserved memberships/history.
- 🟠 CP2-LIVE-003 — Live test required: change a claimed display name and verify the new name throughout Groups, League teams, scorecards and historical Results.


### Beta.10 CP2 Group golfer UX hardening
- 🔵 CP2-GROUP-001 — Group admins create temporary/unclaimed golfers from Group Members with Name, HI and optional email.
- 🔵 CP2-GROUP-002 — Admins can edit an unclaimed golfer's Name, HI and optional email on the same player ID; claimed GGC members are not editable by the Group admin.
- 🔵 CP2-GROUP-003 — Member status displays NOT INVITED / INVITE SENT / GGC MEMBER rather than treating every Group record as a claimed member.
- 🔵 CP2-GROUP-004 — Invite Existing Golfer is restricted to claimed GGC identities from another shared Group.
- 🔵 CP2-LEAGUE-002 — League setup no longer creates golfers; it selects from the owning Group with ADD / IN LEAGUE.
- 🟠 CP2-LIVE-004 — Live test required: create an unclaimed golfer in Group Members, edit name/HI/email, add to League, and verify the same golfer ID/history remains.


## 3.9.6 Beta.11 — CP3 invitations and live-round lifecycle
- 🔵 CP3-INVITE-001 — Existing GGC member Group invitations persist in cloud state and remain pending until ACCEPT or DECLINE.
- 🔵 CP3-INVITE-002 — Unclaimed golfer with an email shows EMAIL ADDED ✅ and can generate a new email-bound claim invite; issuing a new invite replaces the previous token.
- 🔵 CP3-INVITE-003 — Claim token is accepted only when the authenticated email matches the stored golfer email (where an email is present); successful claim clears the token through identity consolidation.
- 🔵 CP3-AUTH-001 — 6-digit verification screen tells the golfer to check Junk/Spam.
- 🔵 CP3-ROUND-001 — Playing-group membership remains editable before scoring and locks after any score is entered.
- 🔵 CP3-ROUND-002 — RESTART ROUND warns, deletes only cards belonging to that playing group, removes that round-group record and allows reselection.
- 🟠 CP3-LIVE-005 — Two-device live test: existing-member Group invitation appears on recipient account and accepts correctly.
- 🟠 CP3-LIVE-006 — New-account live test: invited temporary golfer signs in with matching email and inherits existing Group/League identity without duplication.
- 🟠 CP3-LIVE-007 — Two-device round resume/restart lifecycle requires live verification.
- 🟠 CP3-WL-LIVE-001 — League teammates playing different days/groups still require live Better Ball verification.


## 2026-10-20 — Production Beta 7 identity fixes carried into field-sync development
- 🔵 SIGNIN-IDENTITY-001 — Auth hydration preserves the existing linked golfer ID, including Group and League team references.
- 🔵 SIGNIN-IDENTITY-002 — Duplicate auth-ID records no longer win by array order; explicit identity mappings take priority, then the existing stable golfer ID.
- 🔵 BUILD-IDENTITY-007 — Visible build labels and package version align with production V4 Beta 7.
- 🟠 SIGNIN-LIVE-007 — Device login and visible Group membership still require browser verification; automated tests do not prove every phone is working.
- Scope: targeted port of production commits bc9a9ed, e26880d and 97f0ca8; existing field-sync code and database configuration retained.
- Validation: 119 automated tests passed; Vite production build passed. Database settings were not changed.

## 2026-10-20 — V4 Beta 8 test preview
- 🔵 BUILD-IDENTITY-008 — Field-level-saving development build now displays V4 Beta 8; production remains Beta 7.
- 🟢 SIGNIN-IDENTITY-008 — Production membership fixes retained; 119 automated tests and Vite build passed.
- 🟠 FIELD-SYNC-LIVE-008 — Hands-on saving, reopening, editing and two-player independence testing remains outstanding.

## 2026-10-20 — Beta 8 browser verification: JSONB repeat-save correction
- 🔵 FIELD-NOOP-001 — JSON object key order, including nested objects, no longer creates false edits or repeated preference writes; arrays and changed scores still produce edits.
- 🔵 FIELD-NOOP-002 — Repeatedly enqueueing an unchanged preference after a JSONB round trip performs zero writes.
- Validation: 121 automated tests passed; Vite build passed. Browser retest and scorecard persistence checks remain outstanding.

## 2026-10-20 — Beta 8 hands-on scorecard persistence verification
- Deployment: `dpl_EqHkM5QzcgbfgkrTvA3ZZnFmvZiu`, source `2e4904e48dece52e06def818297fd8cb6335976b`; test Supabase `omgnfrybqiqgxnpwgfol` only.
- 🔵 FIELD-FORM-008 — Signed in as Macca 2; created `Beta 8 persistence test 20 Oct` in Test group, Northampton Golf Club (Harlestone), Yellow tees. Name/course/tee remained stable during entry and creation.
- 🔵 FIELD-RELOAD-008 — Started a two-golfer group card. Macca 2 holes 1–3: 4,3,5; Mike Tyson holes 1–3: 6,5,7. Both cards reached separate database records at version 4. Reloaded browser, used CONTINUE ROUND, and confirmed all six scores in the reopened UI.
- 🔵 FIELD-ISOLATION-008 — Changed only Macca 2 hole 2 from 3 to 4. Its card became version 5 with 4,4,5; partner stayed at version 4 with 6,5,7. A subsequent read-only database query confirmed these versions and values remained saved.
- Evidence IDs: competition `2947d507-160c-420d-83c1-2e25d261ec4a`; round group `6f8e504b-8034-4557-89fe-70d97c8d3b95`; Macca card `d0aa7193-649c-4f17-b434-9acb2f233171`; partner card `fc389011-36fb-426e-8f57-243f97cb2456`.
- 🟠 FIELD-CONCURRENT-008 — Separate authenticated users/devices, simultaneous stale edits and permission boundaries remain unverified. Browser connector became unavailable before opening a second tab; no concurrency pass is claimed.
- 🟠 FIELD-REGRESSION-008 — Full Winter League, team pictures, historical scorecards and complete-round submission regression remain outstanding. The dedicated test round remains incomplete for follow-up testing.
- Production was not changed during these tests. Prior automated validation remains 121 tests and Vite build passed; no source changes were made during this verification.

## 2026-10-20 — Two-tab testing and in-flight remote read race
- 🔵 FIELD-TABS-008 — Two tabs using the same authenticated test account preserved different golfers' hole-4 edits (Macca 5, Mike 6). Both browser views and separate database rows agreed.
- 🔵 FIELD-HOLES-008 — While tab B held Macca hole 5 = 4, tab A saved Macca hole 6 = 6. Both edits merged into the same card, version 8, and appeared in both views.
- 🔴 FIELD-RAPID-008 — Completing the remaining holes in sequence lost Macca hole 14 and Mike hole 11; both were blank in UI and database. This is a release blocker until browser retest passes.
- Reproduced a coordinator race deterministically: a remote read starts, a newer score is enqueued while the read awaits the network, then the older read replaces the new desired snapshot before the write acknowledges it.
- 🔵 FIELD-READ-RACE-008 — Remote reads now defer if the desired snapshot changed while awaiting the network. New regression test fails before the fix and passes after it. All 122 automated tests and Vite build pass.
- 🟠 FIELD-RAPID-RETEST-008 — Corrected preview still requires full browser entry/submission/reload verification. Separate authenticated accounts and permissions remain unverified; same-account tabs do not prove those cases.
- 🔴 FIELD-INPUT-CAPTURE-008 — First corrected-preview retest still retained the previous value for Mike hole 8 during sequential entry. The score handler read the mutable DOM event target inside a queued state updater. It now captures the input string synchronously; browser retest remains required.
- 🔴 FIELD-RENDER-GAP-008 — Input capture alone did not resolve the browser failure: sequential full-card replacement retained four prior scores. Local score changes could be queued for React while the sync guard still referenced the last rendered state.
- 🔵 FIELD-STATE-GUARD-008 — App updates now synchronously advance the state reference used by cloud guards before dispatching the render. A deterministic test verifies an in-flight refresh is rejected after a local edit, before either rendering or the save debounce; consecutive batched local edits also retain each other. 123 tests and build pass; browser retest required.
- 🔴 FIELD-FOCUS-GAP-008 — Full-entry retest still required one re-entry (Macca hole 8 retained prior 4 instead of 5). All 36 values were saved after re-entry, but rapid entry remains unverified. Incoming reads now recheck active input focus at commit time, closing the gap when focus starts during a network request.
- 🔴 FIELD-PENDING-008 — Focus-only retest retained four previous Macca scores. Remote app hydration now waits until every local queued record write is acknowledged, instead of merging a whole app snapshot during local writes. A new test verifies zero remote reads while a score write is pending and successful hydration after acknowledgement. 124 tests and build pass; browser retest required.
- Full 36-score replacement (Macca all 6, Mike all 7) passed without re-entry, matched database at versions 93/100, and survived reload. However the second tab stayed stale: full-snapshot equality treated collection ordering as pending writes. The queue gate now uses `planRecordChanges`, and a new test verifies reordered record collections still receive remote updates. 125 tests and build pass; integrated browser retest required before release.

## 2026-10-20 — Integrated retest outcome: RELEASE BLOCKED
- Tested preview `dpl_2P3PkTv7kzrvagqmFdh83cGAtA33`, commit `3a7e872dfa2fc144ecd1291179a737598f55fe3c`; same test project and same dedicated competition/card IDs as above.
- 🔴 FIELD-RAPID-FINAL-008 — Latest integrated 36-input replacement still retained two previous values: Macca hole 17 = 6 instead of 5, Mike hole 7 = 7 instead of 6. Database confirmed these exact failures at card versions 110/118. The preceding full-card pass does not close this intermittent blocker.
- 🔵 FIELD-LEADERBOARD-008 — After explicitly re-entering those two values, both 18-hole cards saved (Macca all 5 at version 111; Mike all 6 at version 119). UI leaderboard showed 27 and 8 Stableford points, matching an independent calculation from all 18 pars, stroke indexes and PH 9/4.
- 🟠 FIELD-SUBMIT-008 — SUBMIT ROUND opened a native alert and browser automation then timed out on the original tab. Alert was dismissed, but original-tab DOM/screenshot operations remained blocked. Read-only database check still showed both cards `submitted:false`, `submittedAt:null`. Submission is NOT verified; no success claim.
- 🟠 FIELD-PERMISSIONS-008 — Separate authenticated users, authorization boundaries and full Winter League regression remain outstanding.
- Evidence screenshot: `test-evidence/beta8-scorecard-check.png` from the second tab, showing corrected scorecard values. It does not prove successful submission.
- Release decision: do not promote this field-sync preview to production. Keep rapid-entry data loss open despite 125 passing automated tests and passing build. No production code/database changes made during this testing session.

## 2026-10-20 — Recovery versus unsent input investigation
- A deterministic regression test reproduced conflict recovery accepting an older form snapshot while a newer local hole edit awaited the save debounce.
- Recovery now accepts a live-form commit guard and checks it before advancing its baseline; both app-field and card-only retry paths provide that guard. Debounced saves read the current state reference at execution time.
- 126 tests and build passed before preview diagnostics. Temporary preview-only console traces capture score input events and score-state changes to distinguish missing input events from later replacement. No production deployment authorized or performed.
- Root cause located: `App`'s closing brace was after `Admin`, leaving ScoreScreen, competition/group/settings forms and other UI components nested inside App. Every App render recreated their function identities, remounted them and replaced focused inputs/local screen state. Tracing recorded 30 input handlers for 36 fill attempts; the six missing handlers exactly matched all six unchanged values, with no non-input score reversal.
- Moved the App boundary immediately after its returned JSX; all those component declarations now have stable module identities. Verified none depend on App-only closure bindings. New AST regression test fails on the old structure and passes after correction. 127 tests and build pass; browser focus, full-entry and reload retests required.
- Follow-up query confirmed prior submission eventually saved both cards at versions 112/120 with submittedAt `2026-10-20T13:29:19.666Z`; the earlier immediate query was too early, while the native alert blocked the UI task.
- 🔵 FIELD-MOUNT-BROWSER-008 — On `ec4f6b1a8258172a7b6b12a92190a24857424bfc`, focus survived score/save renders. Two consecutive 36-score replacement runs passed without re-entry: first Macca all 4/Mike all 5, then Macca all 5/Mike all 6 with two tabs open. All 36 input handlers were recorded for the first run. Database versions 163/172 and 181/190 matched; the second tab and reload/reopen matched every value.
- 🔴 FIELD-VERSION-ATOMICITY-008 — Subsequent overlapping same-card edit lost tab B's hole 5 while preserving tab A's hole 6. Found independent cause: `store.load` committed a newer row version even when coordinator rejected that refresh, letting stale record data pass a later optimistic version check.
- Staged record reads now commit their versions only when their matching record baseline is accepted. Cancelled conflict recovery also leaves staged versions uncommitted. An invalidated version on an acknowledged record continues to require version-conflict recovery rather than treating it as a new row.
- New integration regression test fails before the fix, then verifies rejected refresh version stays old, stale writes/retries cannot overwrite remote holes, cancelled recovery commits nothing, and accepted recovery preserves both holes. 128 tests and build pass. Temporary input/state traces removed; final integrated browser retest pending.

## 2026-10-20 — Final score entry and version acceptance verification
- Final preview: deployment `dpl_7A3XqiEP35u52hnc9tQKrSu8ioBD`, source `2ac7eea42773e15cbd1ebc77315b6649265594c9`, same stable Beta 8 preview alias and isolated test Supabase project. Production unchanged.
- 🔵 FIELD-RAPID-FINAL-008 — CLOSED for the tested sequence. After the component identity fix, three full 36-score replacement runs passed without re-entry, including the final build with diagnostics removed. Final run saved Macca all 4 and Mike all 5, matching both tabs, database versions 203/205 and reload/reopen. The earlier intermittent missing-event failure no longer reproduced in these runs.
- 🔵 FIELD-VERSION-ATOMICITY-008 — CLOSED for tested same-account tabs. Tab B changed Macca hole 5 to 3 while tab A changed hole 6 to 7. Both edits survived at card version 185 and appeared in both tabs. The following full-card replacement also synced correctly.
- 🔵 FIELD-FORM-STABILITY-008 — Competition draft remained open with `Beta 8 draft focus check` while the other tab changed a score. Draft was cancelled without creating a competition. Score focus also survived save renders.
- 🔵 FIELD-LEADERBOARD-FINAL-008 — Final complete cards produced 45/22 Stableford points, matching independent calculation using all pars, stroke indexes and PH 9/4. Screenshot: `test-evidence/beta8-fixed-leaderboard.png`.
- 🟠 FIELD-SUBMIT-FINAL-008 — Final SUBMIT ROUND attempt again opened a native alert and browser dialog handling timed out. Immediate database query still showed `submitted:false`; do not claim this final submission completed. Earlier submission was separately confirmed at versions 112/120. Native-alert automation remains blocked on the original tab.
- 🟠 RELEASE-GATES-008 — Separate authenticated accounts/devices, authorization boundaries and full Winter League regression still require verification. The tested score-entry and same-account merge defects are resolved on the preview; this is not approval to promote to production.
- Validation: 128 automated tests and Vite build pass. No new source changes after these browser passes; evidence-only commit follows.

## 2026-10-20 — Submission, authorization and Winter League follow-up
- All database operations used isolated test project `omgnfrybqiqgxnpwgfol` / Test GGC account. No production database or production deployment changes.
- 🔵 FIELD-SUBMIT-FINAL-008 — Follow-up query confirmed both final cards submitted at `2026-10-20T13:57:01.955Z`, versions 204/208. Reloaded Home no longer offered the submitted round. Native alert had delayed the immediate verification; submission persistence is now confirmed.
- 🔵 AUTH-SHARED-CARD-008 — Transactional `ggc_shared_scorecard_permissions.sql` passed under authenticated-role subject claims: same-round collaborator allowed; stale version rejected; member outside playing group denied; denied card unchanged.
- 🔵 AUTH-RELATED-READS-008 — Transactional `ggc_related_record_reads.sql` passed: group member reads related league/course/audit/OOM; unrelated course, private preferences and invites hidden; member league/course edits denied; outsider reads denied; owner reads and league edit allowed. All these fixtures rolled back; zero probe rows remain.
- 🔴 AUTH-CROSS-GROUP-INSERT-008 — RELEASE BLOCKER. An authenticated user outside a private group successfully called `ggc_save_record` to create a competition under that group (returned version 1). New expected-denial regression `supabase/tests/ggc_cross_group_insert.sql` fails with `TEST_FAILED: outsider created a competition in a private group`. Probe transaction rolled back and zero `access-boundary-*` records remain. No permission/schema fix applied in this testing-only task.
- Browser permission check: Macca 2 sees MEMBER ACCESS without management controls in non-admin groups, and management controls in the synthetic QA group where explicitly an admin. SQL role/subject tests cover authorization branches; two separate browser authentication sessions and all login methods are not claimed verified.
- 🔴 TEST-DATA-PARITY-008 — Original Winter League test copy has 16 teams/10 weeks but zero league scorecards and zero badge images. Very Little Helps references missing player `496b70e4-7d76-4c10-8355-801477800078`, displayed as `?`. This prevents a claim of full production-data/picture parity. No original roster/history was changed.
- Added clearly named `QA Winter League regression` fixture group/league with 71 records: 8 synthetic golfers, 4 teams, a known par-72 course, 10 weekly competitions (Week 4 cancelled), and 50 separate submitted scorecards. Fixture source is `test/fixtures/winter-league-season.js`; the QA data remains available for review on the test site.
- 🔵 WL-ENGINE-REGRESSION-008 — Eight new automated cases passed: single-golfer team validity; partners on different dates with hole-by-hole Better Ball; 90% allowance; team cuts carried forward with no poor-score recovery; cancelled-week exclusion; weekly countback; best 8/all-round totals; weekly results outside top three; complete synthetic season totals and non-mutation checks.
- 🔵 WL-BROWSER-REGRESSION-008 — Browser table matched independent fixture expectations: Better Ball 352, Solo 321, Level Par 288, No Recovery initially 72, then 80 after adding two gross 2s for the money test. Nine eligible weeks and best eight counted correctly. Weekly Week 1 showed all four teams with 54/45/36/9 points and carried cuts. Four synthetic badge images loaded at 64px; this does not verify absent original team photos.
- 🔴 WL-CANCELLED-LABEL-008 — Cancelling original Week 4 renumbers original Week 5 as displayed W4/Week 4, and later weeks similarly shift. Results, payout labels and 2s labels use list index instead of original week identity. Scores/cancellation exclusion are correct; labels require correction.
- 🔵 WL-MONEY-REGRESSION-008 — QA browser money matched expected £160 contributions, £36 weekly prizes, £60 final prizes split £36/£24 (per-player £18/£12). £64 2s pot rolled forward; two gross 2s by one golfer in final eligible week earned two £32 shares and £64 total. No actual bank/payment action performed.
- A before/after canonical record comparison confirmed zero changes to original players, societies, courses, competitions, scorecards or leagues. Only QA records were added/updated (personal selected-group preference aside).
- Validation: 136 automated tests pass. The separate cross-group SQL denial test fails as documented; do not treat the green Node suite as release approval. No application source changed in this follow-up, and no deployment was made. Screenshot: `test-evidence/beta8-winter-league-regression.png`.

## 2026-10-20 — Deeper-check fixes on test only

- AUTH-CROSS-GROUP-INSERT-008: fixed with `20261020143635_ggc_group_write_boundaries.sql`, applied only to test project omgnfrybqiqgxnpwgfol. New private SECURITY INVOKER predicate removes row-owner bypass for group-scoped writes and is shared by INSERT/UPDATE RLS, full-save and field-patch RPCs. Tested outsider RPC creation, direct INSERT, owned-record move through full save and patch: denied. Legitimate admin create/edit: allowed. Existing shared-scorecard and related-record suites still pass. All permission fixtures rolled back; zero access-boundary probe rows remain.
- WL-WEEK-LABELS-008: week numbers now derive from the whole scheduled season before cancelled rounds are excluded. Weekly results, individual handicap history, winner reasons and 2s ledger use that number. The ledger retains its own competition reference for status rather than indexing by the displayed number. New regression checks that cancelling Week 4 retains Week 5 through Week 10, with nine scored rounds.
- WL-TEST-DATA-008: read-only comparison with production confirmed the missing historical player is Anthony McCormack (HI 7.8), with 30 existing league cards and 16 real badges. Created private test restore point `beta8-before-winter-league-data-repair-20261020` before copying missing cards/player and filling empty badges by matching IDs. Existing test rows win; no wholesale snapshot replacement or branch merge. Restored historical player has no production auth identity, passkey or email. Verified test has 30 league cards, 16 badges and zero unresolved team member IDs. Production unchanged.
- Automated validation: 137 tests pass; Vite build passes (existing lucide module-directive warnings only). SQL denial and allow suites pass. Preview browser verification pending deployment.
- Supabase security advisors: new private predicate has no finding. Existing public SECURITY DEFINER invitation/group RPC findings and disabled leaked-password protection remain separate follow-ups; this is not a claim that the whole project security audit is clean. Remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Private restore-point table intentionally has no client-access policy.
- Preview verification complete: deployment dpl_FWBeCGM6VCQt1dnJt2phGXSBQCKt READY, source commit 3f52dd8eb123c6b84211f45e392468601a5b7a44, preview target only. Edge browser shows V4 Beta 8 synced and QA weeks 1/2/3/5/6/7/8/9/10. QA totals remain 352/321/288/80. All 16 actual team badges loaded after scrolling (initial apparent image failure was lazy loading). Very Little Helps now shows Dan Prescott & Anthony McCormack, not an unknown player. Evidence: test-evidence/beta8-deeper-fixes.png.
- Follow-up data normalization: historical production IDs for Anthony and Darren differed from existing test player IDs. Normalized their references only within this league, its competitions and cards to the existing test IDs (Anthony 5630395f-6cea-4109-9bac-e8f4bae34dfd; Darren 75ca2569-1a64-42af-8d7e-b7eab122e700). This avoids duplicate historical identity links being unreadable to members. Verified zero unresolved card player IDs. The original private restore point covers these changes. Copied cards retain their source content, including incomplete/unsubmitted rounds; no fabricated scores.

## 2026-10-20 — Winter League Results zero-score correction

- Reopened WL-TEST-DATA-008: prior closure was too broad. Restored card count and badges were verified, but Results still displayed zero. Missing Green course plus ambiguous course selection and course RLS caused the failure.
- Restored missing Northampton Green course 052ef6ce-daee-4d82-8ce6-98a3b445a88c on TEST only. Backed up all records in private restore point beta8-before-scorecard-course-repair-20261020 before edits. Normalized the four league cards that incorrectly referenced harlestone/Green to the verified Northampton Green course. No gross score was invented.
- Found the initial structured card transfer shortened arrays: test held 125 entered scores vs source 360. Re-read score arrays as serialized text, validated all 30 IDs and 360 entered scores before replacing only their gross fields. Database aggregate now matches source: 30 Week 1 cards, 360 entered scores, longest card 18 holes. This supersedes the earlier assertion that the initial transfer preserved every score.
- scoreCard now resolves explicit card.courseId ahead of the competition course, independently of course-library order. League Playing Handicap uses the same card course/tee, including rating/slope/par and 90% allowance, rather than the competition's default Yellow tee.
- Applied test-only migration 20261020175646_ggc_scorecard_course_reads.sql: members can read a course referenced by an authorized card, even when the competition has a different default course. Unrelated courses and outsiders remain denied; no course write permissions added.
- Validation: 139 Node tests and Vite build pass. New tests reproduce explicit course priority and Green tee league PH. Related-read SQL covers card-only course access/member allow/outsider deny/private denial; existing cross-group write and shared-card tests pass. Independent hole-by-hole 90% handicap/Better Ball calculation matches all 15 scored teams in test (Mulligan Mafia 43; Fairway Robbery and Guns and Bogeys 42; Long Shots 41). Some source cards remain partial/duplicated, including Very Little Helps; restoring source data does not certify the source itself complete or correct.
- Security advisors retain the previously documented legacy invitation/group-function warnings; no new helper finding. Automatic approval blocked CLI analytics to PostHog; connected database tools completed the migration without that analytics connection.
- Preview deployment/browser verification pending. Production unchanged.
- Browser verification COMPLETE on deployed preview dpl_G2RZi9yeiCmDYz2v8FZiHjAspxxU, READY, source dfc4927784f93f01d5f13c88683cc342d9650f7d; stable Beta 8 test alias refreshed. Signed-in Macca 2 sees Northampton Green course through authorized-card RLS. Results now shows Mulligan Mafia 43, Fairway Robbery 42, Guns and Bogeys 42, Long Shots 41, Bogey Men 40, Putter Madness 39 and remaining team results. QA fixture totals remain 352/321/288/80. Screenshot test-evidence/beta8-restored-winter-league-results.png. This confirms points populate; Very Little Helps still reflects partial source cards (10), and Mars Bar Pushers has no card. No source completeness claim or production release.

## 2026-10-20 — Live Beta 7 Winter League calculation parity copied to Beta 8 test

- Selective test-only data copy from current live ggc_state; source read as serialized JSON text so score arrays are complete. Private restore point `beta8-wl-parity-20261020` captures all test records before the transaction. Production received no writes.
- Copied the 26 current league scorecards (387 entered hole scores), all 10 competition configurations including resultsEmbargo/15-hole release schedules, the complete league setup including locked starting handicap indices/handicap rules/OOM/badges/money settings, referenced Northampton Green course, and names/HI for 32 league golfers. Test auth identities and credentials retained; one missing James Woolgrove player added without a production auth identity. Group membership includes required roster references while retaining test access. Anthony's production ID normalized to the existing test ID; Darren's old ID normalized to his existing canonical ID.
- Four stale test-copy scorecards absent from current live were tombstoned so they cannot be selected instead of the corrected cards. QA Winter League regression fixture records (70 active records) compare byte-for-byte semantically unchanged before/after. No unrelated group/league data replaced.
- Read-back validation: zero mismatches across 70 incoming records (players compared on id/name/HI; all other copied records compared in full). Test now has 26 cards/387 entered scores and 10 enabled release configurations. Restore point confirmed. Initial duplicate-source-ID upsert was rolled back in full, then canonicalized by kind/id before the successful transaction.
- Calculation parity: ran the current main/Beta 7 Winter League engine against the live source and Beta 8 engine against the post-copy test read-back. Exact comparison passes for all 10 weeks, every team point total/hole score/countback order/player Playing Handicap/cut, best-count setting and overall standings. Repeated at a provisional date and after all release dates; both pass. Existing Beta 8 course-priority and cancelled-week-number fixes remain.
- Very Little Helps: 37 provisional through hole 15; 42 after release. Guns and Bogeys: 36 provisional; 43 after release. Both have zero provisional cuts; after release cuts are 3 and 3.5 respectively under copied team split settings. Corrected starting HI snapshot resolves Dave's earlier 12-vs-13 discrepancy without a further scoring-code edit. Corrected live cards resolve the prior 10-point Very Little Helps test result.
- Added a permanent regression for 15-hole masking, no official points/cuts while provisional, full points/cuts after release, and no mutation of stored gross scores. All 140 automated tests pass. No app source or deployment change required for this data alignment. These are database/engine checks; no fresh browser verification performed in this step.
