import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicLeaderboard,
  newShareToken,
  hashShareToken,
  publicShareUrl,
  shareTokenFromHash,
  publicVisibility,
  readPublicLeaderboard,
} from "../src/publicLeaderboard.js";
import { winterLeagueSeasonFixture } from "./fixtures/winter-league-season.js";
const at = Date.parse("2026-10-27T12:00:00Z");
function fixture() {
  const f = winterLeagueSeasonFixture();
  const c = f.state.comps[0];
  return { ...f, c };
}
test("share token has 256 bits, distinct values and SHA256 storage hash", async () => {
  const a = newShareToken(),
    b = newShareToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  assert.equal((await hashShareToken(a)).length, 64);
  assert.notEqual(await hashShareToken(a), a);
  assert.equal(
    await hashShareToken("a".repeat(64)),
    "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
  );
});
test("share URL clears private query parameters and keeps bearer token out of request URL", () => {
  const token = "a".repeat(64),
    url = publicShareUrl(token, "https://ggc.example/?claim=secret#private");
  const u = new URL(url);
  assert.equal(u.search, "");
  assert.equal(shareTokenFromHash(u.hash), token);
  assert.equal(shareTokenFromHash(""), null);
  assert.throws(() => publicShareUrl("bad", "https://ggc.example"));
});
test("public projection retains every Winter League team and does not mutate source cards", () => {
  const { state, c } = fixture(),
    before = JSON.stringify(state);
  const payload = buildPublicLeaderboard(c, state, at);
  assert.equal(payload.rows.length, 4);
  assert.ok(
    payload.rows.some((r) => r.memberIds.includes(state.players[0].id)),
  );
  assert.equal(JSON.stringify(state), before);
  const text = JSON.stringify(payload);
  assert.ok(!text.includes("QA Golfer"));
  assert.ok(!text.includes("authUserId"));
  assert.ok(!text.includes("gross"));
});
test("hidden final holes cannot affect provisional Winter League totals", () => {
  const { state, c } = fixture();
  c.resultsEmbargo = {
    enabled: true,
    releaseAt: "2026-10-30T18:00:00Z",
    visibleThroughHole: 15,
  };
  const original = buildPublicLeaderboard(c, state, at);
  const changed = structuredClone(state);
  changed.cards
    .filter((x) => x.compId === c.id)
    .forEach(
      (card) => (card.gross = card.gross.map((v, i) => (i >= 15 ? 1 : v))),
    );
  assert.deepEqual(buildPublicLeaderboard(c, changed, at), original);
  assert.equal(original.visibleThrough, 15);
  assert.ok(original.provisional);
});
test("scheduled provisional results emit no rows and release restores 18 holes", () => {
  const { state, c } = fixture();
  c.resultsEmbargo = {
    enabled: true,
    provisionalAt: "2026-10-28T12:00:00Z",
    releaseAt: "2026-10-30T18:00:00Z",
  };
  assert.deepEqual(buildPublicLeaderboard(c, state, at).rows, []);
  assert.deepEqual(
    publicVisibility(c, Date.parse(c.resultsEmbargo.releaseAt)),
    { provisional: false, visibleThrough: 18 },
  );
});
test("scramble team scores obey embargo too", () => {
  const { state, c } = fixture();
  state.leagues = [];
  c.leagueId = null;
  c.format = "scramble";
  c.roundGroups = [
    {
      id: "g",
      playerIds: [state.players[0].id],
      teamGross: Array(18).fill(4),
      teamPlayingHandicap: 0,
    },
  ];
  c.resultsEmbargo = {
    enabled: true,
    releaseAt: "2026-10-30T18:00:00Z",
    visibleThroughHole: 15,
  };
  const a = buildPublicLeaderboard(c, state, at);
  c.roundGroups[0].teamGross[17] = 1;
  assert.deepEqual(buildPublicLeaderboard(c, state, at), a);
  assert.equal(a.rows[0].complete, 15);
  assert.equal(a.rows[0].result, "60 net");
});
test("anonymous fetch calls only public function with publishable credentials and no cache", async () => {
  let call;
  const result = await readPublicLeaderboard({
    url: "https://test.supabase.co",
    key: "public-key",
    token: "a".repeat(64),
    fetcher: async (...args) => {
      call = args;
      return { ok: true, json: async () => ({ rows: [] }) };
    },
  });
  assert.deepEqual(result, { rows: [] });
  assert.equal(
    call[0],
    "https://test.supabase.co/functions/v1/beta12-public-leaderboard",
  );
  assert.equal(call[1].headers.Authorization, "Bearer public-key");
  assert.equal(call[1].cache, "no-store");
  assert.equal(call[1].referrerPolicy, "no-referrer");
});
test("invalid tokens make no network request and network errors fail closed", async () => {
  assert.equal(
    await readPublicLeaderboard({
      token: "bad",
      fetcher: () => {
        throw Error("called");
      },
    }),
    null,
  );
  await assert.rejects(
    readPublicLeaderboard({
      url: "x",
      key: "k",
      token: "a".repeat(64),
      fetcher: async () => ({ ok: false }),
    }),
  );
});

test("malformed enabled embargo fails closed", () => {
  const { state, c } = fixture();
  c.resultsEmbargo = { enabled: true, releaseAt: "invalid" };
  assert.deepEqual(buildPublicLeaderboard(c, state, at).rows, []);
  assert.equal(publicVisibility(c, at).visibleThrough, 0);
});

test("deployed function bundle uses identical application scoring engines", async () => {
  const fs = await import("node:fs/promises");
  for (const name of [
    "publicLeaderboard.js",
    "scoring.js",
    "winterLeague.js",
    "groupScoring.js",
    "competitionCourse.js",
    "scoreInput.js",
  ])
    assert.equal(
      await fs.readFile(new URL("../src/" + name, import.meta.url), "utf8"),
      await fs.readFile(
        new URL(
          "../supabase/functions/beta12-public-leaderboard/" + name,
          import.meta.url,
        ),
        "utf8",
      ),
      name + " has drifted",
    );
});
