# GGC 3.7.0 — Competition Groups Foundation

Base: GGC 3.6.2 Stabilisation.

## Changed in this build
- 🔵 CG-001 — Competition Groups are stored separately from existing GGC Groups/Societies.
- 🔵 CG-002 — Create a Competition Group such as Winter League 26/27.
- 🔵 CG-003 — Add/remove existing Group members and show each golfer's current GGC Handicap Index.
- 🔵 CG-004 — Create Week 1–10 as ten normal linked GGC Stableford competitions, one week apart.
- 🔵 CG-005 — Weekly competitions inherit the Competition Group roster as entrants.
- 🔵 CG-006 — Cancel a week without deleting it; reinstate restores its previous status.
- 🔵 CG-007 — Competition Group state migrates safely for existing 3.6.2 users and is included in cloud payload.
- 🔵 BUILD-ID-004 — package and visible Competition Group UI identify GGC v3.7.0.

## Deliberately not in 3.7.0
OOM teams, Best-X, managed Winter League handicaps and Winter League Better Ball aggregation are later staged builds.

## Regression status
- 🟢 3.6.2 deletion tombstones retained.
- 🟢 Existing competition formats/scoring source retained unchanged.
- 🟢 Existing Society/Group model retained; Competition Groups use a separate state collection.
- 🟠 Production Vite compile / deployed Supabase persistence requires branch deployment test.
- 🟠 Multi-device Competition Group sync requires deployed test.
- 🟠 Week 1–10 creation, cancellation and reinstatement require UI live test before 3.8.0.
