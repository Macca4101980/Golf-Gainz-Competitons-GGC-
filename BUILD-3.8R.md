# GGC Build 3.8R
Rebuilt 3.8 with editable Handicap Index.
- My Golf -> Edit Handicap Index.
- Accepts ordinary, scratch and plus display values (e.g. +2.4 is stored as -2.4 internally).
- Profile update is persisted to Supabase profiles when cloud-authenticated.
- First score-card creation snapshots Handicap Index and Course Handicap.
- Later profile HI changes do not recalculate an existing/in-progress/submitted card.
- Completed competition cards therefore retain their historical handicap values.
