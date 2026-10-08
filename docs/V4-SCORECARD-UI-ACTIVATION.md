# V4 scorecard UI activation gates

The `VITE_GGC_V4_SCOPED_SCORECARD_UI` flag enables development-only secure scorecard checks and an opt-in **SUBMIT ROUND** path that writes individual scorecards through the scoped RPCs after server baselines have been opened. It must remain OFF in production. Other scoring/editing paths are still legacy and unsafe for a V4 cutover.

## Before enabling writes
1. Rehearse the protected real production backup in an isolated database. Reconcile golfer IDs, group IDs, competition scope and card IDs; do not publish the backup to CI.
2. Seed `ggc_competition_scope_v4` and `ggc_scorecards_v4` from the verified migration, with a revision for each card.
3. On opening a scorecard, fetch and retain its server revision **and card content as an immutable baseline**. The current localStorage state is not a valid baseline.
4. Before every write, check that the latest server revision/content matches that baseline. Reject conflicts and show reload/reconcile UI; never silently overwrite.
5. Use `ggc_save_my_scorecard_v4` for the signed-in golfer; use `ggc_save_group_scorecard_v4` only for active group admins/owners.
6. Preserve offline edits locally with explicit pending-sync status. Do not claim a score is cloud-saved until the scoped RPC succeeds.
7. Replace all score submission and editing paths, including group submit, restart, individual cards and league scoring. Block or safely replace the legacy whole-state save path.
8. Run live-browser two-device tests, full format regression, WL 25/26 and 26/27 scoring/handicap regression, and rollback rehearsal before production cutover.

The opt-in group submit path uses `createV4ScorecardSession` directly. It verifies each card separately, stops on the first failure, does not report success for unconfirmed cards, and does not automatically retry partially completed submissions. It does not yet reconcile successful server submissions back into the local UI. The standalone `src/v4-scorecard-persist.js` adapter is not called by this path. **This is a development-only integration milestone, not a production-ready scoring implementation.**

## Legacy-write isolation in test mode

With `VITE_GGC_V4_SCOPED_SCORECARD_UI=true`, the React state autosave effect does not call `saveCloud`, and direct `saveCloud` invocations return without writing whole-state data. Local browser state still updates for display and pending edits. **Other competition-management changes made in this mode are not cloud-saved.** Do not enable this flag in production; complete scoped persistence for every mutation path before cutover.
