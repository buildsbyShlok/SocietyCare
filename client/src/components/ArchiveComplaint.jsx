import { useState } from "react";
import { request } from "../api";
import { useAuth } from "../context/AuthContext";

export default function ArchiveComplaint({ id, archived = false, onArchived, onDeleted }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const reason = archived ? null : new FormData(e.currentTarget).get("reason");
    const confirmation = archived
      ? "Delete this archived complaint? It will disappear from complaint views. This action cannot be undone here; its record and audit history will be retained."
      : "Archive this complaint? It will leave the active queue and remain available under Archived complaints.";
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setError("");
    try {
      await request(archived ? "DELETE" : "POST", "/complaints/" + id + (archived ? "" : "/archive"), archived ? null : { reason }, token);
      if (archived) onDeleted(); else onArchived();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="ws-record">
      <summary>{archived ? "Delete archived complaint" : "Archive complaint"}</summary>
      <p>{archived
        ? "Remove this complaint from the archive. The original record and audit history will be retained."
        : "Move this complaint out of the active queue. Its history and archive reason will remain available."}</p>
      <form className="ws-form" onSubmit={submit}>
        {!archived && <label>Archive reason<input required maxLength={500} name="reason" disabled={busy} /></label>}
        {error && <p className="ws-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {busy ? "Saving…" : archived ? "Delete complaint" : "Archive complaint"}
        </button>
      </form>
    </details>
  );
}
