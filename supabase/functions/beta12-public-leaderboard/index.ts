import { buildPublicLeaderboard, TOKEN_PATTERN } from "./publicLeaderboard.js";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};
const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    if (Number(req.headers.get("content-length") || 0) > 512)
      return reply({ error: "Invalid request" }, 400);
    const body = await req.text();
    if (body.length > 512) return reply({ error: "Invalid request" }, 400);
    const { p_token: token } = JSON.parse(body);
    if (!TOKEN_PATTERN.test(token || "")) return reply(null);
    // The unguessable share token is the request credential. No login is required.
    // Service credentials stay in this function and the source RPC is service-only.
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw Error("Configuration unavailable");
    const rpc = async (name, args) => {
      const response = await fetch(url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });
      if (!response.ok) {
        const err = await response.text();
        throw Error(
          err.includes("GGC_PUBLIC_SOURCE_CHANGED")
            ? "GGC_PUBLIC_SOURCE_CHANGED"
            : "Public calculation unavailable",
        );
      }
      return response.json();
    };
    const leaguePayload = await rpc("ggc_get_public_league_leaderboard", { p_token: token });
    if (leaguePayload) return reply(leaguePayload);
    for (let attempt = 0; attempt < 2; attempt++) {
      const source = await rpc("ggc_public_leaderboard_source", {
        p_token: token,
      });
      if (!source) return reply(null);
      const state = {
        players: [],
        societies: [],
        comps: [],
        cards: [],
        leagues: [],
        courses: [],
      };
      for (const r of source.records) {
        if (Object.hasOwn(state, r.kind)) state[r.kind].push(r.data);
      }
      const comp = state.comps.find((c) => c.id === source.competitionId);
      if (!comp) return reply(null);
      const payload = buildPublicLeaderboard(comp, state);
      try {
        return reply(
          await rpc("ggc_commit_public_leaderboard", {
            p_token: token,
            p_source_version: source.sourceVersion,
            p_payload: payload,
          }),
        );
      } catch (e) {
        if (e.message === "GGC_PUBLIC_SOURCE_CHANGED" && attempt === 0)
          continue;
        throw e;
      }
    }
  } catch {
    return reply({ error: "Leaderboard could not be refreshed" }, 503);
  }
});
