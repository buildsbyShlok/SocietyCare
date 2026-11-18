import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Send, ImagePlus, Reply, X, Users, Info, ShieldCheck, Image } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { request } from "../api";
import { formatDateTime } from "../utils/helpers";
import "./Community.css";

export default function Community() {
  const { token, user } = useAuth(),
    admin = user.role === "ADMIN";
  const [params] = useSearchParams();
  const [queue, setQueue] = useState(admin && params.get("view") === "reports"),
    [feed, setFeed] = useState(null),
    [cursor, setCursor] = useState(""),
    [rev, setRev] = useState(0);
  const [draft, setDraft] = useState(""),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(""),
    [reply, setReply] = useState(null);
  const [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const scroll = useRef(null),
    nearBottom = useRef(true),
    picker = useRef(null);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    let active = true,
      timer;
    async function refresh() {
      try {
        const data = await request(
          "GET",
          queue
            ? "/community/reports"
            : "/community" +
                (cursor ? "?before=" + encodeURIComponent(cursor) : ""),
          null,
          token,
        );
        if (active) {
          setFeed(data);
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active && !cursor) timer = setTimeout(refresh, 7000);
      }
    }
    refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, queue, cursor, rev]);
  useEffect(() => {
    if (nearBottom.current && scroll.current && !queue && !cursor)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [feed, queue, cursor]);
  function switchView(nextQueue, nextCursor = "") {
    setQueue(nextQueue);
    setCursor(nextCursor);
    setFeed(null);
    setError("");
    setFeedback("");
    nearBottom.current = true;
  }
  async function act(method, path, body, success) {
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      await request(method, path, body, token);
      setFeedback(success);
      if (path === "/community" && method === "POST") {
        setDraft("");
        setReply(null);
        setFile(null);
        if (picker.current) picker.current.value = "";
        setCursor("");
        nearBottom.current = true;
      }
      setRev((n) => n + 1);
    } catch (e) {
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  function attach(e) {
    const f = e.target.files[0];
    if (
      f &&
      (!["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
        f.size > 5 * 1024 * 1024)
    ) {
      setFeedback("Choose a JPEG, PNG or WebP image up to 5 MB.");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(f || null);
  }
  function send(e) {
    e.preventDefault();
    const data = new FormData();
    data.set("body", draft.trim());
    if (file) data.set("image", file);
    if (reply) data.set("replyToId", reply.id);
    act("POST", "/community", data, "Message sent.");
  }
  return (
    <div className="page ws-page community-page">
      <header className="chat-header">
        <div className="chat-group-icon">
          <Users size={25} />
        </div>
        <div>
          <h1>{queue ? "Community moderation" : "Society conversation"}</h1>
          <p>{queue ? "Review reports and keep the group welcoming" : "A private group for authenticated society members · updates automatically"}</p>
        </div>
        <div className="ws-inline">
          <Link to="/notices">Notice board</Link>
          {admin && (
            <button
              className="btn btn-secondary"
              onClick={() => switchView(!queue)}
            >
              {queue ? "Back to chat" : "Reported messages"}
            </button>
          )}
        </div>
      </header>
      <div className="chat-layout">
      <div className="chat-shell">
        <div
          className="chat-feed"
          ref={scroll}
          tabIndex={0}
          aria-label="Society messages"
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
        >
          {error && (
            <p role="alert">
              {error}{" "}
              <button
                className="btn btn-secondary"
                onClick={() => setRev((n) => n + 1)}
              >
                Retry
              </button>
            </p>
          )}
          {!feed && !error && <p role="status">Loading conversation…</p>}
          <div className="chat-pagination">
            {feed?.hasEarlier && (
              <button
                className="btn btn-secondary"
                onClick={() => switchView(false, feed.items[0].id)}
              >
                Earlier messages
              </button>
            )}
            {cursor && (
              <button
                className="btn btn-secondary"
                onClick={() => switchView(false)}
              >
                Latest messages
              </button>
            )}
          </div>
          {feed?.items.length === 0 && (
            <div className="chat-empty">
              <Users size={32} />
              <h2>
                {queue
                  ? "No reported messages"
                  : "Say hello to your neighbours"}
              </h2>
              <p>
                {queue
                  ? "Reported messages will appear here for review."
                  : "Share a local update or ask the community a question."}
              </p>
            </div>
          )}
          {feed?.items.map((m, i) => {
            const own = m.senderId === user.id,
              day = new Date(m.createdAt).toLocaleDateString();
            return (
              <div key={m.id}>
                {(i === 0 ||
                  day !==
                    new Date(
                      feed.items[i - 1].createdAt,
                    ).toLocaleDateString()) && (
                  <div className="chat-day">{day}</div>
                )}
                <article
                  className={"chat-message" + (own ? " chat-message-own" : "")}
                >
                  <div className="chat-avatar">
                    {m.sender?.avatarUrl ? (
                      <img src={m.sender?.avatarUrl} alt="" />
                    ) : (
                      (m.sender?.name || "?").slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="chat-bubble">
                    <header>
                      <strong>{own ? "You" : m.sender?.name || "Deleted account"}</strong>
                      {m.sender?.role === "ADMIN" && (
                        <span className="chat-admin">Admin</span>
                      )}
                      <small>
                        {m.sender ? "Unit " : "Account removed"}
                        {[m.sender?.tower, m.sender?.flatNumber]
                          .filter(Boolean)
                          .join(" / ")}
                      </small>
                    </header>
                    {m.replyTo && (
                      <blockquote className="chat-quote">
                        {m.replyTo.unavailable ? (
                          "Original message removed"
                        ) : (
                          <>
                            <strong>{m.replyTo.sender?.name || "Deleted account"}</strong>
                            <p>{m.replyTo.body || "Image attachment"}</p>
                          </>
                        )}
                      </blockquote>
                    )}
                    {m.imageUrl && (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer">
                        <img
                          className="chat-image"
                          src={m.imageUrl}
                          alt="Community attachment"
                          loading="lazy"
                        />
                      </a>
                    )}
                    {m.body && <p className="chat-body">{m.body}</p>}
                    <time
                      dateTime={m.createdAt}
                      title={formatDateTime(m.createdAt)}
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {queue &&
                      m.reports.map((r, i) => (
                        <p key={i} className="chat-report">
                          Reported: {r.reason}
                        </p>
                      ))}
                    <div className="chat-options">
                      {!queue && (
                        <button
                          type="button"
                          onClick={() => {
                            setReply(m);
                            document.getElementById("chat-draft")?.focus();
                          }}
                        >
                          <Reply size={14} /> Reply
                        </button>
                      )}
                      <details>
                        <summary>More</summary>
                        <form
                          className="ws-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            act(
                              "POST",
                              "/community/" + m.id + "/report",
                              {
                                reason: new FormData(e.currentTarget).get(
                                  "reason",
                                ),
                              },
                              "Report received.",
                            );
                          }}
                        >
                          <label>
                            Reason for reporting
                            <input name="reason" required maxLength={240} />
                          </label>
                          <button className="btn btn-secondary" disabled={busy}>
                            Report
                          </button>
                        </form>
                        {admin && (
                          <button
                            className="btn btn-danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Remove this message from the community?",
                                )
                              )
                                act(
                                  "DELETE",
                                  "/community/" + m.id,
                                  null,
                                  "Message removed.",
                                );
                            }}
                          >
                            Remove message
                          </button>
                        )}
                      </details>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
        {!queue && (
          <form className="chat-composer" onSubmit={send}>
            {reply && (
              <div className="chat-draft-context">
                <span>
                  Replying to {reply.sender?.name || "Deleted account"}
                  <small>{reply.body || "Image attachment"}</small>
                </span>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  onClick={() => setReply(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {preview && (
              <div className="chat-draft-context">
                <img src={preview} alt="Attachment preview" />
                <span>{file.name}</span>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => {
                    setFile(null);
                    picker.current.value = "";
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <label htmlFor="chat-draft">
              Message to the society <small>{draft.length}/1,000</small>
            </label>
            <div className="chat-compose-row">
              <button
                type="button"
                className="btn btn-secondary"
                aria-label="Attach image"
                title="Attach JPEG, PNG or WebP · up to 5 MB"
                onClick={() => picker.current.click()}
              >
                <ImagePlus size={20} />
              </button>
              <input
                ref={picker}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={attach}
              />
              <textarea
                id="chat-draft"
                rows={2}
                maxLength={1000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
              />
              <button
                className="btn btn-primary"
                aria-label={busy ? "Sending message" : "Send message"}
                disabled={busy || (!draft.trim() && !file)}
              >
                <Send size={18} />
                <span>{busy ? "Sending…" : "Send"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
      {!queue && <aside className="chat-details" aria-labelledby="chat-details-heading">
        <div className="chat-details-icon"><Users size={20} aria-hidden="true" /></div>
        <h2 id="chat-details-heading">About this group</h2>
        <p>Share practical local updates, ask neighbours for help and keep conversation respectful.</p>
        <dl>
          <div><dt><ShieldCheck size={14} aria-hidden="true" />Membership</dt><dd>Authenticated society residents and administrators</dd></div>
          <div><dt><Image size={14} aria-hidden="true" />Attachments</dt><dd>JPEG, PNG and WebP images up to 5 MB</dd></div>
          <div><dt><Info size={14} aria-hidden="true" />Moderation</dt><dd>Report a message when it needs administrator review</dd></div>
        </dl>
      </aside>}
      </div>
      {feedback && (
        <p role="status" className="ws-feedback">
          {feedback}
        </p>
      )}
    </div>
  );
}
