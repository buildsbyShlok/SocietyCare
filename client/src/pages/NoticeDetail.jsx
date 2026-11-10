import { Link, useParams } from "react-router-dom";
import { Pin } from "lucide-react";
import { Load, useResource } from "../components/Workspace";
export default function NoticeDetail() {
  const { id } = useParams();
  const source = useResource("/notices/" + encodeURIComponent(id));
  return (
    <div className="page ws-page">
      <Link to="/notices">Back to notice board</Link>
      <Load source={source}>
        {(n) => (
          <article className="notice-reading announcement-reading">
            <header className="reading-heading">
              <div className="ws-inline notice-category">
                {n.isPinned && (
                  <>
                    <Pin size={16} /> Pinned announcement ·{" "}
                  </>
                )}
                {n.category}
              </div>
              <h1>{n.title}</h1>
              <p className="ws-muted">
                Published {new Date(n.createdAt).toLocaleString()} ·{" "}
                {n.author?.name || "Deleted account"}
              </p>
            </header>
            <div className="reading-body">{n.content}</div>
            {n.updatedAt !== n.createdAt && (
              <small className="ws-muted">
                Updated {new Date(n.updatedAt).toLocaleString()}
              </small>
            )}
          </article>
        )}
      </Load>
    </div>
  );
}
