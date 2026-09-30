# GGC 3.6.2 Stabilisation Regression

## Blue — changed in this build
- Competition deletion tombstones (`deletedCompIds`) persist through local/cloud state.
- Realtime merge unions tombstones first, then filters deleted competitions and their cards.
- Deleting a Group tombstones all competitions in that Group.
- Group Formats Test Pack added to Settings > Regression Testing.
- Build labels/package version updated to 3.6.2.

## Group Formats Test Pack
Known four-player 18-hole cards are supplied for Texas Scramble, Scramble, Florida Scramble, Shamble, Best 1/2/3, Cha Cha Cha, Irish Fourball, Bowmaker, Alliance and Yellow Ball.

IMPORTANT: the current scoring source marks these Group formats `verified:false`. The test pack is deliberately the start of verification; it does not falsely mark them as correct. Several Group formats currently fall through to individual-card leaderboard behaviour and therefore require dedicated team scoring implementation before they can be marked green.

## Targeted deletion regression
PASS (static/logic): tombstone survives local+stale remote merge; stale remote competition is filtered; associated stale cards are filtered; Group deletion records all child competition IDs.

## Live checks still required
- Supabase realtime on deployed build / two devices.
- PWA update/cache behaviour.
- Each Group format against independently calculated expected result.
