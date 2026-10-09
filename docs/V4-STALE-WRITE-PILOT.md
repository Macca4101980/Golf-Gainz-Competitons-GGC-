# Stale-device write prevention — pilot test plan

Flag: `VITE_GGC_CAS_WRITES=true`. OFF by default.

## Test with two sessions
1. Both devices load the same initial cloud revision.
2. Device A changes a test Group and saves successfully.
3. Device B attempts to save its older state. It must show **Cloud conflict** and must not replace A's data.
4. Reload device B from the cloud, then make a fresh edit and save. It should succeed.
5. Verify competition scores, cards, golfer identities and Group memberships did not disappear.
6. Repeat with multiple browsers, offline/reconnect, and rapid repeated edits.

## Remaining blockers
- This opt-in client protection does NOT stop older production builds using the unguarded POST endpoint. Enforce server-side conditional writes and remove legacy overwrite privileges before declaring a fix.
- Simultaneous local saves and cloud refreshes require explicit queue/retry handling; current conflicts are deliberately fail-closed, not automatically merged.
- Real backup restoration, verified claims, full regression, and rollback rehearsal are still required.
- Do not enable the flag in production or merge PR #51 until all gates pass.
