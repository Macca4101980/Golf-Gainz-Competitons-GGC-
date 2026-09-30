# GGC 3.7.1 — Leagues correction

3.7.0 preview was not promoted. This build replaces the Competition Groups prototype with the agreed League model.

## New / corrected
- 🔵 LEAGUE-001 — Feature is called **Leagues** / **Create a League**, not Competition Groups.
- 🔵 LEAGUE-002 — New League name is blank with placeholder **League name**; no Winter League default.
- 🔵 LEAGUE-003 — Planned number of competitions is configurable (1–52); no fixed 10-week generator.
- 🔵 LEAGUE-004 — Creating a League does not automatically create competitions.
- 🔵 LEAGUE-005 — League competitions use the existing full GGC Competition creator.
- 🔵 LEAGUE-006 — Each League competition can independently choose any currently enabled GGC format and normal course/tee/handicap/money/2s settings.
- 🔵 LEAGUE-007 — League roster is passed into a newly created League competition as entrants.
- 🔵 LEAGUE-008 — League competition records carry leagueId and appear back inside their League.
- 🔵 LEAGUE-009 — Cancel/reinstate remains a data-level League-week state without deleting the competition.
- 🔵 LEAGUE-010 — Existing 3.7 prototype competitionGroups data migrates into leagues.
- 🔵 BUILD-ID-005 — Main header and scorecard build labels corrected to Build 3.7.1.

## Deliberately later
OOM/teams/Best-X: 3.8.x. Managed League handicap engine: later staged build. Winter League Better Ball aggregation: later staged build.

## Regression
- 🟢 Existing Society/Group layer remains separate from Leagues.
- 🟢 3.6.2 deletion tombstones retained.
- 🟢 Existing scoring engine and format list not replaced by League-specific scoring.
- 🟠 Vercel Preview compile/deployment to be verified.
- 🟠 Create League → create mixed-format competitions → reload/cloud sync requires live UI test.
- 🟠 Cancel/reinstate and roster carry-over require live UI test.
