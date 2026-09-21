# GGC Build 3.5 scoring engine

Verified/enabled in this build:
- Individual Stableford
- Nett Medal / Stroke Play
- Gross Medal / Gross Stroke Play
- Par / Bogey (W/H/L against nett par; leaderboard +/-)
- Blind Pairs (individual Stableford cards followed by a saved one-time draw)

Other format names remain visible for planning, but creation is deliberately blocked until their dedicated setup, handicap, score-entry, team aggregation and completion rules are implemented and tested. This prevents GGC from silently scoring a specialist format as Stableford/Medal.

Course Handicap calculation was corrected to: HI × Slope / 113 + (Course Rating − Par).
