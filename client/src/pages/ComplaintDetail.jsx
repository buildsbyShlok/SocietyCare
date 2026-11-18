import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Tag,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  X,
  FileImage,
  FileText,
  ArrowRight,
  MessageSquare,
  Send,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { complaints as complaintsApi } from "../api/index";
import { useAuth } from "../context/AuthContext";
import ComplaintSource from '../components/ComplaintSource';
import {
  ROLES,
  STATUS_LABELS,
  CATEGORY_LABELS,
  ALLOWED_STATUS_TRANSITIONS,
} from "../utils/constants";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";
import { formatDateTime } from "../utils/helpers";
import "./ComplaintDetail.css";
import Dialog from "../components/Dialog";
import ArchiveComplaint from "../components/ArchiveComplaint";

/**
 * ComplaintDetail — Modernized SaaS 70/30 Layout with Chronological Timeline (Phase 4A/5)
 */
export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  // ── Complaint state ────────────────────────────────────────────────────────
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // ── Photo Lightbox state ───────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // ── Status update form state ───────────────────────────────────────────────
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [remark, setRemark] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchComplaint() {
      if (!id) {
        setError("No complaint ID specified.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setErrorStatus(null);
      setComplaint(null);
      try {
        const data = await complaintsApi.getById(id, token);
        if (cancelled) return;
        if (data?.complaint && typeof data.complaint.id === "string") {
          setComplaint({
            ...data.complaint,
            history: Array.isArray(data.complaint.history)
              ? data.complaint.history.filter(
                  (entry) => entry && typeof entry === "object",
                )
              : [],
          });
        } else {
          setError(
            "The server returned an incomplete complaint record. Please try again.",
          );
        }
        // Reset inputs on fresh load
        setNewStatus("");
        setNewPriority("");
        setRemark("");
        setUpdateError("");
      } catch (err) {
        if (cancelled) return;
        setErrorStatus(err.status);
        setError(err.message || "Failed to load complaint");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchComplaint();
    return () => {
      cancelled = true;
    };
  }, [id, token, refetchTrigger]);

  async function handleStatusUpdate(e) {
    e.preventDefault();
    if (!newStatus && !newPriority) {
      setUpdateError(
        "Please select a status transition or a priority override.",
      );
      return;
    }

    setUpdateError("");
    setSuccessMsg("");
    setUpdating(true);
    try {
      const payload = { remark: remark.trim() || null };
      if (newStatus) payload.status = newStatus;
      if (newPriority) payload.priority = newPriority;

      await complaintsApi.updateStatus(id, payload, token);
      setSuccessMsg("Complaint status updated successfully.");
      setRefetchTrigger((t) => t + 1); // trigger local refresh
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setUpdateError(err.message || "Failed to update complaint");
    } finally {
      setUpdating(false);
    }
  }

  // ── Loading Skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page complaint-detail-workspace">
        <div className="back-navigation-container">
          <div
            className="skeleton"
            style={{ width: "130px", height: "18px", borderRadius: "4px" }}
          />
        </div>
        <header className="page-header">
          <div className="page-header-title">
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div
                className="skeleton"
                style={{ width: "60px", height: "22px", borderRadius: "4px" }}
              />
              <div
                className="skeleton"
                style={{
                  width: "80px",
                  height: "22px",
                  borderRadius: "9999px",
                }}
              />
              <div
                className="skeleton"
                style={{
                  width: "70px",
                  height: "22px",
                  borderRadius: "9999px",
                }}
              />
            </div>
            <div
              className="skeleton"
              style={{ width: "55%", height: "28px", borderRadius: "6px" }}
            />
          </div>
        </header>

        <div className="complaint-detail-layout">
          <main className="complaint-detail-main">
            <div className="card workspace-panel">
              <div
                className="skeleton"
                style={{ width: "110px", height: "18px", marginBottom: "14px" }}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <div
                  className="skeleton"
                  style={{ width: "100%", height: "14px" }}
                />
                <div
                  className="skeleton"
                  style={{ width: "92%", height: "14px" }}
                />
                <div
                  className="skeleton"
                  style={{ width: "75%", height: "14px" }}
                />
              </div>
            </div>
          </main>
          <aside className="complaint-detail-sidebar">
            <div className="card workspace-panel">
              <div
                className="skeleton"
                style={{ width: "120px", height: "18px", marginBottom: "14px" }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  className="skeleton"
                  style={{ width: "100%", height: "28px" }}
                />
                <div
                  className="skeleton"
                  style={{ width: "100%", height: "28px" }}
                />
                <div
                  className="skeleton"
                  style={{ width: "100%", height: "28px" }}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ── Error State / Not Found State ──────────────────────────────────────────
  if (error || !complaint) {
    const isForbidden = errorStatus === 403;
    return (
      <div className="page complaint-detail-workspace">
        <div className="back-navigation-container">
          <Link to="/complaints" className="complaint-back-link">
            <ArrowLeft size={14} />
            <span>Return to Complaints Board</span>
          </Link>
        </div>

        <div
          className="card empty-state"
          style={{
            padding: "var(--space-10) var(--space-6)",
            textAlign: "center",
            marginTop: "var(--space-4)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "var(--color-danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-3) auto",
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: "700",
              color: "var(--color-text-primary)",
              margin: "0 0 var(--space-1) 0",
            }}
          >
            {error || "Complaint Not Found"}
          </h2>
          <p
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-secondary)",
              maxWidth: "420px",
              margin: "0 auto var(--space-5) auto",
              lineHeight: "1.5",
            }}
          >
            {isForbidden
              ? "You do not have permission to view or manage this maintenance complaint."
              : errorStatus === 404
                ? "The requested complaint ticket does not exist or may have been deleted."
                : "Unable to load this complaint. Please retry or return to the complaints board."}
          </p>
          {![403, 404].includes(errorStatus) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setRefetchTrigger((n) => n + 1)}
            >
              Retry
            </button>
          )}
          <Link
            to="/complaints"
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={14} />
            <span>Back to Complaints Board</span>
          </Link>
        </div>
      </div>
    );
  }

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[complaint.status] || [];
  const canUpdateStatus =
    !complaint.archivedAt && isAdmin && allowedTransitions.length > 0;
  const shortId = `#${complaint.id.slice(-6).toUpperCase()}`;

  return (
    <div className="page complaint-detail-workspace">
      {/* Back navigation */}
      <div className="back-navigation-container">
        <Link to="/complaints" className="complaint-back-link">
          <ArrowLeft size={14} />
          <span>Back to Issues Board</span>
        </Link>
      </div>

      {/* Header section with statuses and ID */}
      <header className="page-header detail-header">
        <div className="page-header-title">
          <div className="detail-header-badges">
            <span className="complaint-id-mono" title={`ID: ${complaint.id}`}>
              {shortId}
            </span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            {complaint.isOverdue && (
              <span className="badge badge-danger detail-overdue-badge">
                <AlertTriangle size={11} /> Overdue
              </span>
            )}
          </div>
          <h1 className="detail-ticket-title">{complaint.title}</h1>
          <div className="detail-meta-subtitle">
            <Calendar size={13} />
            <span>Logged on {formatDateTime(complaint.createdAt)}</span>
          </div>
        </div>
      </header>

      {/* ── Main 70/30 Split Layout ── */}
      <div className="complaint-detail-layout">
        {/* Left Side (70%) - Description, Photo Evidence, History Timeline */}
        <main className="complaint-detail-main">
          <AnimatePresence>
            {successMsg && (
              <motion.div
                className="alert alert-success"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                role="alert"
              >
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Description Section */}
          <section className="card workspace-panel">
            <h2 className="panel-title">
              <FileText size={16} className="panel-title-icon" />
              <span>Issue Description</span>
            </h2>
            <div className="complaint-detail-description">
              <p className="complaint-detail-text">{complaint.description}</p>
            </div>
          </section>

          {/* Attached Evidence Section */}
          {complaint.photoUrl && (
            <section className="card workspace-panel">
              <div className="panel-header-row">
                <h2 className="panel-title">
                  <FileImage size={16} className="panel-title-icon" />
                  <span>Attached Evidence</span>
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm photo-zoom-trigger"
                  onClick={() => setLightboxOpen(true)}
                  aria-label="View full size photo"
                >
                  <Maximize2 size={13} />
                  <span>Expand Photo</span>
                </button>
              </div>

              <div
                className="photo-gallery-frame"
                onClick={() => setLightboxOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightboxOpen(true);
                  }
                }}
                aria-label="Click to enlarge photo evidence"
              >
                <img
                  src={complaint.photoUrl}
                  alt={`Evidence artifact for complaint ${shortId}`}
                  className="complaint-detail-photo"
                  loading="lazy"
                />
                <div className="photo-overlay-hint">
                  <Maximize2 size={18} />
                  <span>Click to Enlarge</span>
                </div>
              </div>
            </section>
          )}

          {/* Lifecycle History Timeline */}
          <section className="card workspace-panel">
            <h2 className="panel-title">
              <Clock size={16} className="panel-title-icon" />
              <span>Activity & Audit Trail</span>
            </h2>

            {complaint.archivedAt && (
              <div className="ws-feedback" role="status">
                <strong>Removed from the active queue</strong>
                <p>
                  {formatDateTime(complaint.archivedAt)} ·{" "}
                  {complaint.archiveReason}
                </p>
                <small>
                  {complaint.archivedById === user.id
                    ? "Removed by you"
                    : isAdmin
                      ? "Archived by " + complaint.archivedById
                      : "Archived by society management"}{" "}
                  · Record and history retained
                </small>
              </div>
            )}
            {complaint.history && complaint.history.length > 0 ? (
              <div className="complaint-history-timeline">
                {complaint.history.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    className="complaint-history-item"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <div className="complaint-history-dot-wrapper">
                      <div
                        className="complaint-history-dot"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="complaint-history-content">
                      <div className="complaint-history-transition">
                        <StatusBadge status={entry.fromStatus} />
                        <ArrowRight
                          size={12}
                          className="complaint-history-arrow-svg"
                        />
                        <StatusBadge status={entry.toStatus} />
                      </div>

                      <div className="complaint-history-meta">
                        <span className="history-author">
                          <User size={11} />
                          <strong>
                            {entry.changedBy?.name || "Deleted account"}
                          </strong>
                        </span>
                        <span className="bullet-separator" aria-hidden="true">
                          ·
                        </span>
                        <span className="history-timestamp">
                          <Clock size={11} />
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>

                      {entry.remark && (
                        <blockquote className="complaint-history-note">
                          <MessageSquare
                            size={13}
                            className="note-quote-icon"
                          />
                          <span>{entry.remark}</span>
                        </blockquote>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="no-history-text">
                No status transitions logged yet. The ticket is currently in its
                initial{" "}
                <strong className="text-accent">
                  {STATUS_LABELS[complaint.status] || complaint.status}
                </strong>{" "}
                state.
              </p>
            )}
          </section>
        </main>

        {/* Right Side (30%) - Properties & State Transitions Form */}
        <aside className="complaint-detail-sidebar">
          {isAdmin && <section className="card workspace-panel linked-equipment" aria-label="Complaint origin and equipment">
            <h2 className="panel-title">Complaint origin</h2>
            <ComplaintSource source={complaint.source} />
            {complaint.asset ? <dl>
              <div><dt>Asset</dt><dd><Link to={'/assets/' + complaint.asset.id}>{complaint.asset.name}</Link></dd></div>
              <div><dt>Asset code</dt><dd>{complaint.asset.assetCode}</dd></div>
              <div><dt>Equipment category</dt><dd>{complaint.asset.category}</dd></div>
              <div><dt>Location</dt><dd>{complaint.asset.location}</dd></div>
            </dl> : <p className="ws-muted">Not linked to an asset</p>}
          </section>}
          {/* Issue Properties Panel */}
          <div className="card workspace-panel">
            <h2 className="panel-title">
              <Layers size={16} className="panel-title-icon" />
              <span>Ticket Properties</span>
            </h2>

            <div className="metadata-list">
              <div className="metadata-item">
                <span className="metadata-label">Category</span>
                <span className="metadata-value">
                  {CATEGORY_LABELS[complaint.category] || complaint.category}
                </span>
              </div>

              {complaint.resident && (
                <div className="metadata-item">
                  <span className="metadata-label">Resident / Reporter</span>
                  <span className="metadata-value reporter-val">
                    <User size={13} />
                    <span>
                      {complaint.resident.name} · Flat{" "}
                      {complaint.resident.flatNumber}
                    </span>
                  </span>
                </div>
              )}

              <div className="metadata-item">
                <span className="metadata-label">Initial Submission</span>
                <span className="metadata-value">
                  {formatDateTime(complaint.createdAt)}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Last Updated</span>
                <span className="metadata-value">
                  {formatDateTime(complaint.updatedAt)}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Reference ID</span>
                <span className="metadata-value font-mono text-accent">
                  {complaint.id}
                </span>
              </div>
            </div>
          </div>

          <ArchiveComplaint
            id={id}
            archived={Boolean(complaint.archivedAt)}
            onArchived={() => setRefetchTrigger((n) => n + 1)}
            onDeleted={() => navigate("/complaints?archived=true")}
          />
          {/* Admin State Transition Form */}
          {canUpdateStatus && (
            <div className="card workspace-panel transition-panel">
              <h2 className="panel-title">
                <ShieldCheck
                  size={16}
                  className="panel-title-icon text-accent"
                />
                <span>Admin State Transition</span>
              </h2>

              <form
                onSubmit={handleStatusUpdate}
                className="complaint-update-form"
                noValidate
              >
                {updateError && (
                  <div
                    className="alert alert-error"
                    role="alert"
                    style={{ fontSize: "11px", padding: "8px" }}
                  >
                    <AlertCircle size={14} />
                    <span>{updateError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="new-status" className="form-label">
                    Next Status
                  </label>
                  <select
                    id="new-status"
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={updating}
                  >
                    <option value="">— Select Transition —</option>
                    {allowedTransitions.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="new-priority" className="form-label">
                    Override Priority{" "}
                    <span className="text-muted">(Optional)</span>
                  </label>
                  <select
                    id="new-priority"
                    className="form-select"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    disabled={updating}
                  >
                    <option value="">— Retain Current Priority —</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="remark" className="form-label">
                    Status Remark / Note{" "}
                    <span className="text-muted">(Optional)</span>
                  </label>
                  <textarea
                    id="remark"
                    className="form-textarea"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Provide context or instructions for this status change..."
                    rows={3}
                    disabled={updating}
                  />
                </div>

                <button
                  type="submit"
                  id="update-status-submit"
                  className="btn btn-primary btn-submit-transition"
                  disabled={updating || (!newStatus && !newPriority)}
                >
                  {updating ? (
                    <>
                      <span className="spinner-border" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Apply Transition</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>

      {lightboxOpen && complaint.photoUrl && (
        <Dialog
          open
          onClose={() => setLightboxOpen(false)}
          label="Complaint photo evidence"
          className="photo-lightbox-modal"
        >
          <div className="photo-lightbox-header">
            <span className="lightbox-title">Photo evidence · {shortId}</span>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close photo preview"
            >
              <X size={18} />
            </button>
          </div>
          <div className="photo-lightbox-body">
            <img
              src={complaint.photoUrl}
              alt={"Full size photo evidence"}
              className="lightbox-full-img"
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
