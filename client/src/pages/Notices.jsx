import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusCircle,
  Pin,
  PinOff,
  Edit3,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Check,
} from "lucide-react";
import { notices as noticesApi } from "../api/index";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../utils/constants";
import { formatDateTime } from "../utils/helpers";
import "./Notices.css";

// ─── Client-side Validation ───────────────────────────────────────────────────
function validate(form) {
  const errors = {};
  const title = form.title.trim();
  const content = form.content.trim();

  if (!title || title.length < 3)
    errors.title = "Title must be at least 3 characters";
  else if (title.length > 150)
    errors.title = "Title must not exceed 150 characters";
  if (!content || content.length < 10)
    errors.content = "Content must be at least 10 characters";

  return errors;
}

/**
 * Notices Board — Resident Broadcasts & Admin Announcement Management (Phase 4B)
 */
export default function Notices() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  // ── Fetch state ────────────────────────────────────────────────────────────
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const location = useLocation();

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Action loading states ──────────────────────────────────────────────────
  const [pinningId, setPinningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchNotices() {
      setLoading(true);
      setError("");
      try {
        const data = await noticesApi.list({ page, limit: 10 }, token);
        setNotices(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.totalItems || 0);
        setHasNextPage(data.hasNextPage || false);
        setHasPreviousPage(data.hasPreviousPage || false);
      } catch (err) {
        setError(err.message || "Failed to load notices");
      } finally {
        setLoading(false);
      }
    }

    fetchNotices();
  }, [token, page]);

  // Check for redirected state success message
  useEffect(() => {
    if (location.state?.success) {
      setSuccessMsg(location.state.success);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setSuccessMsg(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  // ── Edit handlers ──────────────────────────────────────────────────────────
  function startEdit(notice) {
    setEditingId(notice.id);
    setEditForm({
      title: notice.title,
      content: notice.content,
      category: notice.category || "General",
    });
    setEditFieldErrors({});
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFieldErrors({});
    setEditError("");
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    if (editFieldErrors[name]) {
      setEditFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  async function handleEditSave(id) {
    const errors = validate(editForm);
    setEditFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEditSaving(true);
    setEditError("");
    try {
      const data = await noticesApi.update(
        id,
        {
          title: editForm.title.trim(),
          content: editForm.content.trim(),
          category: editForm.category,
        },
        token,
      );
      setNotices((prev) => prev.map((n) => (n.id === id ? data.notice : n)));
      setEditingId(null);
      setSuccessMsg("Notice updated successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      if (err.errors && err.errors.length > 0) {
        setEditError(err.errors.join(" · "));
      } else {
        setEditError(err.message || "Failed to save changes");
      }
    } finally {
      setEditSaving(false);
    }
  }

  // ── Pin / Unpin ────────────────────────────────────────────────────────────
  async function handleTogglePin(id) {
    setPinningId(id);
    setActionError("");
    try {
      const data = await noticesApi.togglePin(id, token);
      setNotices((prev) => {
        const updated = prev.map((n) => (n.id === id ? data.notice : n));
        return [...updated].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
      setSuccessMsg(
        data.notice.isPinned ? "Notice pinned to top." : "Notice unpinned.",
      );
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setActionError(err.message || "Failed to update pin status");
    } finally {
      setPinningId(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (
      !window.confirm(
        "Are you sure you want to delete this notice? This action cannot be undone.",
      )
    ) {
      return;
    }
    setDeletingId(id);
    setActionError("");
    try {
      await noticesApi.delete(id, token);
      setNotices((prev) => prev.filter((n) => n.id !== id));
      setSuccessMsg("Notice deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setActionError(err.message || "Failed to delete notice");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page notices-board">
      {/* Page Header */}
      <header className="page-header">
        <div className="page-header-title">
          <h1>Society notice board</h1>
          <p className="page-header-subtitle">
            Official society announcements, maintenance notifications, and
            updates
          </p>
        </div>
        <div className="workspace-actions">
          {isAdmin && (
            <Link to="/notices/new" className="btn btn-primary">
              <PlusCircle size={15} />
              <span>Publish Notice</span>
            </Link>
          )}
        </div>
      </header>

      {/* Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            className="alert alert-success"
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {actionError && (
          <motion.div
            className="alert alert-error"
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      {loading ? (
        <div className="notices-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card notice-card">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  className="skeleton"
                  style={{ width: "45%", height: "20px", borderRadius: "4px" }}
                />
                <div
                  className="skeleton"
                  style={{ width: "90%", height: "14px", borderRadius: "4px" }}
                />
                <div
                  className="skeleton"
                  style={{ width: "80%", height: "14px", borderRadius: "4px" }}
                />
                <div
                  className="skeleton"
                  style={{
                    width: "30%",
                    height: "12px",
                    borderRadius: "4px",
                    marginTop: "6px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : notices.length === 0 ? (
        <div className="card empty-state notices-empty">
          <div className="empty-state-icon-box">
            <Megaphone size={30} />
          </div>
          <h3>No Announcements Posted</h3>
          <p className="empty-state-desc">
            {isAdmin
              ? "Broadcast your first community notice using the button above."
              : "There are currently no active community bulletins."}
          </p>
          {isAdmin && (
            <Link
              to="/notices/new"
              className="btn btn-primary btn-sm"
              style={{ marginTop: "var(--space-2)" }}
            >
              <PlusCircle size={14} />
              <span>Publish First Notice</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="notices-list">
          {notices.map((notice) => (
            <motion.article
              key={notice.id}
              className={`card notice-card${notice.isPinned ? " notice-card--pinned" : ""}`}
              initial={false}
            >
              {/* ── Inline Edit Mode ── */}
              {editingId === notice.id ? (
                <div className="notice-inline-form">
                  <div className="inline-form-header">
                    <span className="inline-form-title">Edit Announcement</span>
                    <button
                      type="button"
                      className="inline-close-btn"
                      onClick={cancelEdit}
                      disabled={editSaving}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {editError && (
                    <div
                      className="alert alert-error"
                      role="alert"
                      style={{ fontSize: "11px", padding: "8px" }}
                    >
                      <AlertCircle size={14} />
                      <span>{editError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label
                      htmlFor={`edit-title-${notice.id}`}
                      className="form-label"
                    >
                      Title
                    </label>
                    <input
                      id={`edit-title-${notice.id}`}
                      name="title"
                      type="text"
                      className={`form-input${editFieldErrors.title ? " is-error" : ""}`}
                      value={editForm.title}
                      onChange={handleEditChange}
                      maxLength={150}
                      disabled={editSaving}
                    />
                    {editFieldErrors.title && (
                      <p className="form-error">{editFieldErrors.title}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor={`edit-content-${notice.id}`}
                      className="form-label"
                    >
                      Content
                    </label>
                    <textarea
                      id={`edit-content-${notice.id}`}
                      name="content"
                      className={`form-textarea${editFieldErrors.content ? " is-error" : ""}`}
                      value={editForm.content}
                      onChange={handleEditChange}
                      rows={5}
                      disabled={editSaving}
                    />
                    {editFieldErrors.content && (
                      <p className="form-error">{editFieldErrors.content}</p>
                    )}
                  </div>

                  <label>
                    Category
                    <select
                      className="form-input"
                      name="category"
                      value={editForm.category}
                      onChange={handleEditChange}
                    >
                      {["General", "Maintenance", "Security", "Community"].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <div className="notice-inline-form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={cancelEdit}
                      disabled={editSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleEditSave(notice.id)}
                      disabled={editSaving}
                    >
                      {editSaving ? (
                        <>
                          <span className="spinner-border" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read Mode ── */
                <>
                  <div className="notice-card-header">
                    <div className="notice-title-group">
                      {notice.isPinned && (
                        <span className="notice-pin-badge">
                          <Pin size={11} />
                          <span>Pinned</span>
                        </span>
                      )}
                      <span className="notice-category">
                        {notice.category || "General"}
                      </span>
                      <h2 className="notice-card-title">
                        <Link to={"/notices/" + notice.id}>{notice.title}</Link>
                      </h2>
                    </div>

                    {isAdmin && (
                      <div className="notice-card-actions">
                        {/* Pin / Unpin */}
                        <button
                          type="button"
                          className={`btn btn-sm ${notice.isPinned ? "btn-secondary is-pinned-btn" : "btn-secondary"}`}
                          onClick={() => handleTogglePin(notice.id)}
                          disabled={pinningId === notice.id}
                          title={
                            notice.isPinned
                              ? "Unpin from top"
                              : "Pin to top of board"
                          }
                        >
                          {pinningId === notice.id ? (
                            <span className="spinner-border" />
                          ) : notice.isPinned ? (
                            <>
                              <PinOff size={13} />
                              <span className="action-btn-text">Unpin</span>
                            </>
                          ) : (
                            <>
                              <Pin size={13} />
                              <span className="action-btn-text">Pin</span>
                            </>
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEdit(notice)}
                          disabled={
                            pinningId === notice.id || deletingId === notice.id
                          }
                          title="Edit notice"
                        >
                          <Edit3 size={13} />
                          <span className="action-btn-text">Edit</span>
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(notice.id)}
                          disabled={deletingId === notice.id}
                          title="Delete notice"
                        >
                          {deletingId === notice.id ? (
                            <span className="spinner-border" />
                          ) : (
                            <>
                              <Trash2 size={13} />
                              <span className="action-btn-text">Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="notice-card-content">{notice.content}</p>

                  <div className="notice-card-footer">
                    <div className="notice-meta-item">
                      <User size={12} className="notice-meta-icon" />
                      <span>
                        {notice.author?.name || "Deleted account"}
                      </span>
                    </div>
                    <span className="bullet-separator" aria-hidden="true">
                      ·
                    </span>
                    <div className="notice-meta-item">
                      <Calendar size={12} className="notice-meta-icon" />
                      <span>{formatDateTime(notice.createdAt)}</span>
                    </div>
                  </div>
                </>
              )}
            </motion.article>
          ))}
        </div>
      )}

      {/* Server-Side Pagination */}
      {!loading && totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="btn btn-secondary btn-sm pagination-btn"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!hasPreviousPage}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>

          <div className="pagination-indicator">
            Page <span className="pagination-current">{page}</span> of{" "}
            <span className="pagination-total">{totalPages}</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm pagination-btn"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!hasNextPage}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
