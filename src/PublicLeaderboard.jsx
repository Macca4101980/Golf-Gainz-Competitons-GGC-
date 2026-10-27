import React, { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import {
  buildPublicLeaderboard,
  newShareToken,
  hashShareToken,
  publicShareUrl,
  readPublicLeaderboard,
} from "./publicLeaderboard.js";
function ShareLeaderboardButton({ url, title }) {
  const [message, setMessage] = useState("");
  async function share() {
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied.");
      }
    } catch (error) {
      if (error?.name !== "AbortError")
        setMessage("Could not share. Copy the link from the address bar.");
    }
  }
  return <div>
    <button type="button" className="secondary" onClick={share}
      aria-label="Share leaderboard" title="Share leaderboard">
      <Share2 aria-hidden="true" size={20} /> SHARE LEADERBOARD
    </button>
    {message && <p role="status">{message}</p>}
  </div>;
}
export function PublicLeaderboard({ url, apiKey, token }) {
  const [data, setData] = useState(null),
    [status, setStatus] = useState("Loading leaderboard…");
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
  useEffect(() => {
    let active = true,
      busy = false;
    setData(null);
    setStatus("Loading leaderboard…");
    const controller = new AbortController();
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const next = await readPublicLeaderboard({
          url,
          key: apiKey,
          token,
          signal: controller.signal,
        });
        if (active) {
          setData(next);
          setStatus(next ? "" : "This leaderboard link is unavailable.");
        }
      } catch (e) {
        if (active && e.name !== "AbortError") {
          setData(null);
          setStatus("Unable to refresh. Check your connection and try again.");
        }
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    const wake = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [url, apiKey, token]);
  return (
    <div className="publicLeaderboard">
      <header>
        <span>GOLF GAIN COMPS</span>
        <h1>{data?.title || "Public leaderboard"}</h1>
        <p>Shared results · view only</p>
        {data && <ShareLeaderboardButton url={publicShareUrl(token)} title={data.title} />}
      </header>
      <main>
        {status && (
          <p role="status" className="card">
            {status}
          </p>
        )}
        {data && (
          <>
            <div className="publicBoardMeta">
              <b>
                {data.provisional
                  ? (data.visibleThrough === 0 ? "RESULTS SCHEDULED" : "PROVISIONAL · THROUGH HOLE " + data.visibleThrough)
                  : "PUBLISHED RESULTS"}
              </b>
              <small>
                Last published {new Date(data.publishedAt).toLocaleString()} ·
                checks for updates every 15 seconds
              </small>
            </div>
            {data.rows?.length ? (
              <div className="leader card">
                <div className="leaderHeader">
                  <b>LIVE LEADERBOARD</b>
                  <small>Published GGC results</small>
                </div>
                {data.rows.map((r, i) => (
                  <div className="leaderrow" key={i}>
                    <strong>{r.position}</strong>
                    <span>
                      <b>{r.name}</b>
                      <small>{r.complete}/{r.totalHoles} holes</small>
                    </span>
                    <em>{r.result}</em>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card">
                {data.visibleThrough === 0
                  ? "Results are scheduled for later."
                  : "No published scores yet."}
              </p>
            )}
            <p className="muted">
              Names are shown by default; golfers can hide their identity in My Golf. Results
              refresh automatically from saved GGC scorecards.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
export function PublicShareControls({ c, state, client, publicEnabled = true, isAdmin = true }) {
  const [share, setShare] = useState(null),
    [link, setLink] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const latest = useRef({ c, state });
  latest.current = { c, state };
  const mounted = useRef(true);
  const working = useRef(false);
  const sharingDisabled = publicEnabled === false;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setShare(null);
    setLink("");
    if (publicEnabled && isAdmin && client)
      client
        .rpc("ggc_public_share_status", { p_competition_id: c.id })
        .then(({ data, error }) => {
          if (active) {
            if (error)
              setMessage("Sharing is not ready on this test environment.");
            else setShare(data);
          }
        });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [client, c.id, publicEnabled, isAdmin]);
  async function action(mode) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      let args = {
        p_competition_id: c.id,
        p_action: mode,
        p_token_hash: null,
        p_payload: null,
        p_expected_version: share?.version || 0,
      };
      let token;
      if (mode === "publish" || mode === "refresh" || mode === "rotate") {
        const snap = latest.current;
        args.p_payload = buildPublicLeaderboard(snap.c, snap.state);
        if (!share?.enabled || mode === "rotate") {
          token = newShareToken();
          args.p_token_hash = await hashShareToken(token);
        }
      }
      const { data, error } = await client.rpc("ggc_manage_public_share", args);
      if (error) throw error;
      if (mounted.current) {
        setShare(data);
        if (token) setLink(publicShareUrl(token));
        if (mode === "revoke") setLink("");
        setMessage(mode === "revoke" ? "Link disabled." : "Results published.");
      }
    } catch (e) {
      if (mounted.current)
        setMessage(e.message || "Sharing failed. Try again.");
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (sharingDisabled) {
    return (
      <div className="card publicShareControls" role="status">
        <h3>PUBLIC SHARING OFF</h3>
        <p>The Group admin has turned off public leaderboard sharing.</p>
      </div>
    );
  }
  if (!isAdmin) return null;
  return (
    <details className="card publicShareControls">
      <summary aria-label="Share leaderboard" style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", minHeight:44}}><Share2 aria-hidden="true" size={20} /> SHARE LEADERBOARD</summary>
      <h3>PUBLIC LEADERBOARD</h3>
      <p>
        Anyone with the link can view published scores without a GGC account.
        Names are shown by default. Golfers can hide their identity under My Golf.
      </p>
      <p className="muted">
        The public page refreshes saved scores every 15 seconds, even when the
        organiser closes GGC.
      </p>
      <div className="publicShareActions">
        <button
          className="primary"
          disabled={busy || !client}
          onClick={() => action("publish")}
        >
          {share?.enabled ? "PUBLISH NOW" : "ENABLE & CREATE LINK"}
        </button>
        {share?.enabled && (
          <>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Replace the share link? The previous link will stop working.",
                  )
                )
                  void action("rotate");
              }}
            >
              REPLACE LINK
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => action("revoke")}
            >
              DISABLE LINK
            </button>
          </>
        )}
      </div>
      {link && <ShareLeaderboardButton url={link} title={c.name} />}
      {link && (
        <label>
          Shareable link
          <input
            aria-label="Public leaderboard link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Link copied.");
              } catch {
                setMessage("Select and copy the link above.");
              }
            }}
          >
            COPY LINK
          </button>
        </label>
      )}
      {share?.enabled && !link && (
        <p>The link is active. Replace it to create a new link you can copy.</p>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function PublicIdentityPreference({ client, playerId }) {
  const [visible, setVisible] = useState(true),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true);
    client
      ?.rpc("ggc_public_identity", { p_visible: null })
      .then(({ data, error }) => {
        if (active) {
          setVisible(data === true);
          setBusy(false);
          if (error) setMessage("Public name settings are not available yet.");
        }
      });
    return () => {
      active = false;
    };
  }, [client, playerId]);
  async function change(value) {
    setBusy(true);
    try {
      const { error } = await client.rpc("ggc_public_identity", {
        p_visible: value,
      });
      if (error) throw error;
      setVisible(value);
      setMessage(
        value
          ? "Your name may appear on shared leaderboards."
          : "Your name is hidden on shared leaderboards.",
      );
    } catch {
      setMessage("Name preference could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>PUBLIC LEADERBOARD NAME</h3>
      <label>
        <input
          type="checkbox"
          checked={visible}
          disabled={busy || !client}
          onChange={(e) => change(e.target.checked)}
        />{" "}
        Show my name on public leaderboards
      </label>
      <p className="muted">
        On by default. Turn this off if you want to appear as an anonymous golfer or
        team.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
