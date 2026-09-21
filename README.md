# GGC — Golf Gainz Comps · Build 1

Mobile-first prototype for simple society/group golf competitions.

## Build 1 foundation
- Remembered player + Handicap Index
- Create competitions: Stableford, Stroke Play, 4BBB, Waltz, Best 2 from 4, Texas Scramble
- Course library with reusable tees (Course Rating, Slope, 18-hole Par/SI/yardage model)
- Duration and separate daily-money-pot option
- OOM model designed around field size; team/pairs award is divided equally among entry members
- Winter League dashboard link
- Supabase shared-state support using current publishable keys
- Admin PIN default: `2026`

## Supabase
Create a separate Supabase project called `Golf Gainz Comps`. Run `supabase-setup.sql`, then add the two variables from `.env.example` to Vercel Production.

## Important
Build 1 is the foundation/UI and data model. The complete live scoring engine, payouts, OOM calculation, card locking and multi-device conflict handling should be stress-tested before the app is used for real money competitions.

## Course data
Staverton Yellow is preloaded from the club's published scorecard. Cold Ashby, Brampton Heath, Sharpley and Ramside are included as starter course records ready for verified tee/hole data. This avoids silently loading uncertain or mismatched tee data.
