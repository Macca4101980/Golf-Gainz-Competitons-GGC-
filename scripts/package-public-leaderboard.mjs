import { mkdir, copyFile } from "node:fs/promises";
const dir = new URL(
  "../supabase/functions/beta12-public-leaderboard/",
  import.meta.url,
);
await mkdir(dir, { recursive: true });
for (const name of [
  "publicLeaderboard.js",
  "leagueDisplay.js",
  "scoring.js",
  "winterLeague.js",
  "groupScoring.js",
  "competitionCourse.js",
  "scoreInput.js",
])
  await copyFile(
    new URL("../src/" + name, import.meta.url),
    new URL(name, dir),
  );
