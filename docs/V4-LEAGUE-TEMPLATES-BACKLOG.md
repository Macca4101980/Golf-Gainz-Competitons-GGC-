# V4 League Templates — queued after scoring/data-safety regression

Status: **design backlog only**. Do not enable in production or displace migration, secure scoring, Winter League, and all-format regression gates.

## Loadable templates
1. **Winter League** — 90% initial playing handicap by default; independently saved individual cards, including teammates playing on different days; hole-by-hole Better Ball when both play, lone valid card when only one plays; team-level handicap reductions with no automatic recovery by default; cancelled weeks excluded; configurable best X of Y (default 8 of 10); optional final-four matchplay playoffs.
2. **Summer Order of Merit** — points awarded by finishing position, scaled to size of field; configurable points scale, best X of Y, ties/countback, individual or team, and event formats.
3. **Matchplay Knockout** — seeded/random draw, byes, bracket progression, singles or pairs, match result and conceded/walkover handling, handicap allowance.
4. **Matchplay Round Robin** — everyone plays everyone once or twice; singles or pairs; two ranking modes:
   - **Hole difference first:** win 6&4 = +6, loss 3&2 = -3, win 2&1 = +2, cumulative +5. Draw = 0.
   - **Match points first:** win 3, draw 1, loss 0; cumulative hole difference is the first tiebreaker.
   - Each completed match records signed winning margin for both sides; a 6&4 result means +6/-6, not +4/-4. A 2 UP result means +2/-2. A tied match means 0/0.
   - Display P/W/D/L, match points, hole difference, and rank in both modes. Remaining tiebreakers (e.g., head-to-head) configurable or explicitly shared position, not arbitrary order.

## Design constraints
- Templates are versioned starting configurations, not hardcoded Winter League special cases; create/edit/import/export template JSON with schema validation and explicit defaults.
- Do not overwrite existing league data when applying a template. New league ID and fixture IDs must be generated.
- Permissions: only authorized group administrators create or edit league structure; golfer card writes stay scoped to their card/authorized delegation.
- Preserve old league data, membership, audit trail and scores; do not migrate template functionality to production until tested.

## Regression acceptance
- Independently calculated examples for both round-robin ranking modes and both sides of every result.
- Equal match points resolved by signed hole difference, draws, 2 UP, 6&4, 3&2, and round-robin schedule completeness.
- Knockout byes, semifinal advancement, finals and walkovers.
- Summer OOM field-size thresholds, ties, and best-X.
- Winter League lone teammate, split-day cards, Better Ball, team cuts, best 8/10, cancellations, countback, playoffs.
- No production deployment until protected real-data rehearsal and rollback pass.
