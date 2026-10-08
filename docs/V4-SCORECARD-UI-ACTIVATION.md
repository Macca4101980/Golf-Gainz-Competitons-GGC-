# V4 scorecard UI activation gates

The `VITE_GGC_V4_SCOPED_SCORECARD_UI` flag enables a **read-only** comparison control on the group scoring screen. It does not sync or submit scores.

## Before enabling writes
1. Rehearse the protected real production backup in an isolated database. Reconcile golfer IDs, group IDs, competition scope and card IDs; do not publish the backup to CI.
2. Seed `ggc_competition_scope_v4` and `ggc_scorecards_v4` from the verified migration, with a revision for each card.
3. On opening a scorecard, fetch and retain its server revision **and card content as an immutable baseline**. The current localStorage state is not a valid baseline.
4. Before every write, check that the latest server revision/content matches that baseline. Reject conflicts and show reload/reconcile UI; never silently overwrite.
5. Use `ggc_save_my_scorecard_v4` for the signed-in golfer; use `ggc_save_group_scorecard_v4` only for active group admins/owners.
6. Preserve offline edits locally with explicit pending-sync status. Do not claim a score is cloud-saved until the scoped RPC succeeds.
7. Replace all score submission and editing paths, including group submit, restart, individual cards and league scoring. Block or safely replace the legacy whole-state save path.
8. Run live-browser two-device tests, full format regression, WL 25/26 and 26/27 scoring/handicap regression, and rollback rehearsal before production cutover.

The staged scorecard adapter (`src/v4-scorecard-persist.js`) is intentionally **not called** from the scoring screen yet. The read-only UI check can identify mismatches but cannot resolve them automatically.
