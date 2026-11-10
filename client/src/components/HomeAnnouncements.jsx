import { useEffect, useState } from "react";
import { Pin, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { request } from "../api";
import { useAuth } from "../context/AuthContext";
import "./HomeAnnouncements.css";

// Follow the existing pagination contract so Home does not silently omit older notices.
export default function HomeAnnouncements() {
  const { token } = useAuth();
  const [result, setResult] = useState({}),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult({});
    async function load() {
      try {
        const found = new Map();
        let page = 1,
          more = true;
        while (more && active) {
          const data = await request(
            "GET",
            "/notices?sort=latest&limit=50&page=" + page,
            null,
            token,
          );
          for (const n of data.items || []) found.set(n.id, n);
          more = Boolean(data.hasNextPage);
          page++;
        }
        if (active) setResult({ items: [...found.values()] });
      } catch (e) {
        if (active) setResult({ error: e.message });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token, attempt]);
  if (result.error)
    return (
      <p role="alert">
        {result.error}{" "}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry
        </button>
      </p>
    );
  if (!result.items) return <p role="status">Loading announcements…</p>;
  if (!result.items.length) return <p>No announcements published yet.</p>;
  return (
    <div className="community-noticeboard" aria-label="Published society notices">
      {result.items.map((n, index) => (
        <Link
          className={"board-note board-note-tone-" + (index % 3) + (n.isPinned ? " board-note-pinned" : "")}
          key={n.id}
          to={"/notices/" + n.id}
        >
          <i className="board-note-pin" aria-hidden="true" />
          <div className="board-note-meta">
            <span>{n.category || "General"}</span>
            {n.isPinned ? (
              <span>
                <Pin size={13} /> Pinned
              </span>
            ) : (
              <ArrowUpRight size={16} />
            )}
          </div>
          <div>
            <h3>{n.title}</h3>
            <p>{n.content}</p>
          </div>
          <footer className="board-note-footer"><time dateTime={n.createdAt}>
            {new Date(n.createdAt).toLocaleDateString([], {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time><span>Read notice <ArrowUpRight size={14}/></span></footer>
        </Link>
      ))}
    </div>
  );
}
