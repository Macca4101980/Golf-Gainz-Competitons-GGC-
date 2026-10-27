import {
  scoreCard,
  FORMAT_RULES,
  formatResult,
  pairScore,
  fourballMatchResult,
} from "./scoring.js";
import { winterLeagueTable } from "./winterLeague.js";
import { groupLeaderboard, isGroupFormat } from "./groupScoring.js";
export const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export function newShareToken(cryptoApi = globalThis.crypto) {
  return Array.from(cryptoApi.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hashShareToken(token, cryptoApi = globalThis.crypto) {
  if (!TOKEN_PATTERN.test(token)) throw Error("Invalid share link");
  return Array.from(
    new Uint8Array(
      await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export function publicShareUrl(token, base = globalThis.location.href) {
  if (!TOKEN_PATTERN.test(token)) throw Error("Invalid share link");
  const u = new URL(base);
  u.search = "";
  u.hash = "leaderboard=" + token;
  return u.href;
}
export function shareTokenFromHash(hash) {
  return new URLSearchParams(String(hash).replace(/^#/, "")).get("leaderboard");
}
export function publicVisibility(c, now = Date.now()) {
  const e = c?.resultsEmbargo;
  const release = Date.parse(e?.releaseAt);
  if (
    e?.enabled &&
    (!Number.isFinite(release) ||
      (e.provisionalAt && !Number.isFinite(Date.parse(e.provisionalAt))))
  )
    return { provisional: true, visibleThrough: 0 };
  const provisional = !!(
    e?.enabled &&
    Number.isFinite(release) &&
    now < release
  );
  const at = Date.parse(e?.provisionalAt);
  return {
    provisional,
    visibleThrough: provisional
      ? Number.isFinite(at) && now < at
        ? 0
        : Math.max(1, Math.min(17, Number(e.visibleThroughHole) || 15))
      : 18,
  };
}
export function buildPublicLeaderboard(c, state, now = Date.now()) {
  const visibility = publicVisibility(c, now);
  const through = visibility.visibleThrough;
  // All score-bearing sources must be masked, including scramble teamGross.
  const masked = {
    ...state,
    cards: (state.cards || []).map((card) =>
      card.compId === c.id
        ? {
            ...card,
            gross: (card.gross || []).map((v, i) => (i < through ? v : "")),
          }
        : card,
    ),
  };
  const comp = {
    ...c,
    roundGroups: (c.roundGroups || []).map((g) => ({
      ...g,
      teamGross: (g.teamGross || []).map((v, i) => (i < through ? v : "")),
    })),
  };
  const totalHoles =
    c.holesMode === "front9" || c.holesMode === "back9" ? 9 : 18;
  const row = (ids, r, result, teamId = null) => ({
    memberIds: ids.filter(Boolean),
    teamId,
    result: String(result).slice(0, 80),
    complete: Math.min(totalHoles, Math.max(0, Number(r.complete) || 0)),
    totalHoles,
  });
  let rows = [];
  if (through) {
    const league = (state.leagues || []).find(
      (l) => l.id === c.leagueId && (l.teams || []).length,
    );
    if (league) {
      const week = winterLeagueTable(league, masked, new Date(now)).weekly.find(
        (w) => w.comp.id === c.id,
      );
      rows = (week?.resultsHidden ? [] : week?.rows || []).map((r) =>
        row(
          league.teams.find((t) => t.id === r.teamId)?.memberIds || [],
          r,
          r.points + " pts",
          r.teamId,
        ),
      );
    } else if (isGroupFormat(c.format)) {
      rows = groupLeaderboard(comp, masked).map((r) =>
        row(
          r.playerIds || [],
          r,
          r.lowerWins ? r.net + " net" : r.points + " pts",
        ),
      );
    } else if (
      FORMAT_RULES[c.format]?.category === "pairs" &&
      c.format !== "blind-pairs"
    ) {
      if (c.format === "4bbb-match") {
        if ((c.pairs || []).length !== 2)
          throw Error("Set two matchplay pairs before sharing");
        const r = fourballMatchResult(c.pairs[0], c.pairs[1], comp, masked);
        rows = c.pairs.map((p, i) =>
          row(
            p.ids,
            { complete: r.played },
            r.up === 0
              ? "AS"
              : Math.abs(r.up) +
                  ((i === 0 ? r.up : -r.up) > 0 ? " UP" : " DOWN"),
          ),
        );
      } else {
        const rs = (c.pairs || []).map((p) => ({
          p,
          r: pairScore(p, comp, masked),
        }));
        const lower = FORMAT_RULES[c.format]?.lowerWins;
        rs.sort((a, b) =>
          lower ? a.r.rankValue - b.r.rankValue : b.r.rankValue - a.r.rankValue,
        );
        rows = rs.map(({ p, r }) =>
          row(p.ids, r, lower ? r.net + " net" : r.points + " pts"),
        );
      }
    } else if (c.format === "blind-pairs") {
      rows = (c.blindDraw?.pairs || [])
        .map((p) => {
          const ids = Array.isArray(p) ? p : p.ids || [];
          const rs = ids.map((id) => {
            const card = masked.cards.find(
              (x) => x.compId === c.id && x.playerId === id,
            );
            return card ? scoreCard(card, comp, masked) : null;
          });
          if (rs.some((r) => !r)) return null;
          return row(
            ids,
            { complete: Math.min(...rs.map((r) => r.complete)) },
            rs.reduce((s, r) => s + r.points, 0) + " pts",
          );
        })
        .filter(Boolean);
      rows.sort((a, b) => parseFloat(b.result) - parseFloat(a.result));
    } else {
      if (c.format === "matchplay" || !FORMAT_RULES[c.format]?.verified)
        throw Error("Public sharing is not available for this format yet");
      const rs = masked.cards
        .filter((x) => x.compId === c.id)
        .map((card) => scoreCard(card, comp, masked))
        .filter((r) => r.player);
      rs.sort((a, b) =>
        FORMAT_RULES[c.format].lowerWins
          ? a.rankValue - b.rankValue
          : b.rankValue - a.rankValue,
      );
      rows = rs.map((r) => row([r.player.id], r, formatResult(r, c.format)));
    }
  }
  return {
    schemaVersion: 1,
    ...visibility,
    rows: rows.slice(0, 500).map((r, i) => ({ ...r, position: i + 1 })),
  };
}
export async function readPublicLeaderboard({
  url,
  key,
  token,
  signal,
  fetcher = fetch,
}) {
  if (!TOKEN_PATTERN.test(token || "")) return null;
  const response = await fetcher(
    url + "/functions/v1/beta12-public-leaderboard",
    {
      method: "POST",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    },
  );
  if (!response.ok) throw Error("Leaderboard could not be refreshed");
  return response.json();
}

export function buildPublicLeagueLeaderboard(league, state, now = Date.now()) {
  const weeks = winterLeagueTable(league, state, new Date(now));
  const provisional = (weeks.weekly || []).some(w => w.provisional || w.resultsHidden);
  const rows = (weeks.table || []).map((r, i) => ({
    memberIds: r.memberIds || [],
    teamId: r.id,
    position: i + 1,
    result: String(r.total ?? 0) + " pts",
    complete: 18,
    totalHoles: 18,
  }));
  return {
    schemaVersion: 1,
    scope: "league",
    title: league.name,
    provisional,
    visibleThrough: 18,
    rows,
  };
}
