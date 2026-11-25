import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pin } from "lucide-react";
import { formatDateTime } from "../utils/helpers";
import { Load, useResource } from "../components/Workspace";
export default function NoticeDetail() {
  const { id } = useParams();
  const source = useResource("/notices/" + encodeURIComponent(id));
  return (
    <div className="page ws-page">
      <Link className="back-link" to="/notices">
        <ArrowLeft size={15} aria-hidden="true" />
        All announcements
      </Link>
      <Load source={source}>
        {(n) => (
          <article className="notice-reading announcement-reading">
            <header className="reading-heading">
              <div className="ws-inline notice-category">
                {n.isPinned && (
                  <>
                    <Pin size={14} aria-hidden="true" /> Pinned ·{" "}
                  </>
                )}
                {n.category}
              </div>
              <h1>{n.title}</h1>
              <p className="ws-muted">
                Published {formatDateTime(n.createdAt)} ·{" "}
                {n.author?.name || "Deleted account"}
              </p>
            </header>
            <div className="reading-body">{n.content}</div>
            {n.updatedAt !== n.createdAt && (
              <small className="ws-muted">
                Updated {formatDateTime(n.updatedAt)}
              </small>
            )}
          </article>
        )}
      </Load>
    </div>
  );
}
