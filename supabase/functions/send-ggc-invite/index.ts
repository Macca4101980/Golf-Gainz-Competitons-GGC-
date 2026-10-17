import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string,string>)[c]);
const makeToken = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const { playerId } = await request.json().catch(() => ({}));
    if (typeof playerId !== "string" || !playerId) return json({ error: "Missing golfer" }, 400);

    const { data: row, error: playerError } = await client.from("ggc_records")
      .select("data,version").eq("kind", "players").eq("record_id", playerId).eq("deleted", false).maybeSingle();
    if (playerError || !row) return json({ error: "Golfer not accessible" }, 403);
    const player = row.data;
    if (!player?.email || player.authUserId || !(player.unclaimed || player.placeholder || player.guest)) {
      return json({ error: "Golfer is not eligible for an email invite" }, 400);
    }

    const { data: players, error: playersError } = await client.from("ggc_records")
      .select("data").eq("kind", "players").eq("deleted", false);
    const { data: societies, error: societiesError } = await client.from("ggc_records")
      .select("data").eq("kind", "societies").eq("deleted", false);
    if (playersError || societiesError) return json({ error: "Unable to verify group permissions" }, 403);
    const callerIds = new Set([user.id, ...(players || [])
      .filter(r => r.data?.authUserId === user.id || r.data?.id === user.id).map(r => r.data.id)]);
    const authorized = (societies || []).some(({ data: group }) =>
      Array.isArray(group?.members) && group.members.includes(playerId) &&
      [...callerIds].some(id => group.ownerId === id || (group.admins || []).includes(id)));
    if (!authorized) return json({ error: "Only a Group Owner or Admin can email this invite" }, 403);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Email service is not configured" }, 503);
    const claimToken = makeToken();
    const preparedAt = new Date().toISOString();
    const prepared = { ...player, claimToken, invitePreparedAt: preparedAt, updatedAt: preparedAt };
    const { data: preparedVersion, error: prepareError } = await client.rpc("ggc_save_record", {
      p_kind: "players", p_id: playerId, p_data: prepared,
      p_expected_version: row.version, p_deleted: false,
    });
    if (prepareError) return json({ error: "Invite preparation conflicted with another edit", code: prepareError.code }, 409);

    const inviteUrl = "https://golfgainzcomps.co.uk/?claim=" + encodeURIComponent(claimToken);
    const from = Deno.env.get("GGC_INVITE_FROM") || "Golf Gainz Comps <invites@golfgainzcomps.co.uk>";
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#07120b;color:#fff;padding:32px;border-radius:18px"><h1>GOLF GAINZ COMPS</h1><p>Hi ${escapeHtml(player.name || "Golfer")},</p><p>You've been invited to join Golf Gainz Comps. Your golfer and Group membership have already been set up for you.</p><p><a href="${escapeHtml(inviteUrl)}">JOIN GGC</a></p><p>Sign in using ${escapeHtml(player.email)}.</p></div>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [player.email], subject: "You've been invited to Golf Gainz Comps", html }),
    });
    const sent = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "Email provider rejected the invite; token was prepared", tokenPrepared: true }, 502);

    const sentAt = new Date().toISOString();
    const updated = { ...prepared, membershipStatus: "invite-sent", inviteSentAt: sentAt, updatedAt: sentAt };
    const { error: statusError } = await client.rpc("ggc_save_record", {
      p_kind: "players", p_id: playerId, p_data: updated,
      p_expected_version: preparedVersion, p_deleted: false,
    });
    if (statusError) return json({ ok: true, id: sent.id, statusRecorded: false, warning: "Email sent; invitation status needs reconciliation" });
    return json({ ok: true, id: sent.id, player: updated, statusRecorded: true });
  } catch (error) {
    console.error("GGC invite function error", error instanceof Error ? error.message : "Unknown");
    return json({ error: "Invitation request failed" }, 500);
  }
});
