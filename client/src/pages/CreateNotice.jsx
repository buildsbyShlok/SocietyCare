import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Pin,
  AlertCircle,
  Megaphone,
} from 'lucide-react';
import { notices as noticesApi } from '../api/index';
import { useAuth } from '../context/AuthContext';
import './CreateNotice.css';

// ─── Client-side Validation ───────────────────────────────────────────────────
function validate(form) {
  const errors = {};
  const title = form.title.trim();
  const content = form.content.trim();

  if (!title || title.length < 3) errors.title = 'Title must be at least 3 characters';
  else if (title.length > 150) errors.title = 'Title must not exceed 150 characters';

  if (!content || content.length < 10) errors.content = 'Content must be at least 10 characters';
  else if (content.length > 5000) errors.content = 'Content must not exceed 5000 characters';

  return errors;
}

/**
 * CreateNotice — Admin Broadcast Publishing Flow (Phase 4B)
 */
export default function CreateNotice() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ title: '', content: '' });
  const [isPinned, setIsPinned] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await noticesApi.create(
        { title: form.title.trim(), content: form.content.trim(), isPinned, category: form.category || "General" },
        token
      );
      navigate('/notices', { state: { success: 'Official announcement published to bulletin board.' } });
    } catch (err) {
      if (err.errors && err.errors.length > 0) {
        setApiError(err.errors.join(' · '));
      } else {
        setApiError(err.message || 'Failed to publish notice. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page create-notice-page">
      <div className="back-navigation-container">
        <Link to="/notices" className="complaint-back-link">
          <ArrowLeft size={14} />
          <span>Back to Bulletin Board</span>
        </Link>
      </div>

      <header className="page-header">
        <div className="page-header-title">
          <h1>Publish Announcement</h1>
          <p className="page-header-subtitle">
            Broadcast an official society notice to the community bulletin board
          </p>
        </div>
      </header>

      <motion.div
        className="card create-notice-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <form onSubmit={handleSubmit} noValidate>
          {apiError && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
              <AlertCircle size={16} />
              <span>{apiError}</span>
            </div>
          )}

          <label className="form-group">Category<select className="form-input" name="category" value={form.category || "General"} onChange={handleChange}>{["General","Maintenance","Security","Community"].map(c=><option key={c}>{c}</option>)}</select></label>
          {/* Form Field: Title */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="notice-title" className="form-label">
                Announcement Title <span className="text-danger">*</span>
              </label>
              <span className="character-count-indicator">{form.title.length} / 150</span>
            </div>
            <input
              id="notice-title"
              name="title"
              type="text"
              className={`form-input${fieldErrors.title ? ' is-error' : ''}`}
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Scheduled Water Tank Cleaning & Supply Interruption"
              maxLength={150}
              disabled={submitting}
              autoComplete="off"
            />
            {fieldErrors.title && <p className="form-error">{fieldErrors.title}</p>}
          </div>

          {/* Form Field: Content */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="notice-content" className="form-label">
                Detailed Body <span className="text-danger">*</span>
              </label>
              <span className="character-count-indicator">{form.content.length} / 5000</span>
            </div>
            <textarea
              id="notice-content"
              name="content"
              className={`form-textarea${fieldErrors.content ? ' is-error' : ''}`}
              value={form.content}
              onChange={handleChange}
              placeholder="Write the full broadcast announcement, schedule, affected wings/flats, and instructions for residents…"
              rows={7}
              disabled={submitting}
            />
            {fieldErrors.content && <p className="form-error">{fieldErrors.content}</p>}
          </div>

          {/* Pinned Priority Card */}
          <div
            className={`pin-toggle-card${isPinned ? ' is-pinned' : ''}`}
            onClick={() => setIsPinned(!isPinned)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setIsPinned(!isPinned);
              }
            }}
          >
            <div className="pin-toggle-checkbox">
              <input
                id="notice-important"
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                disabled={submitting}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="pin-toggle-info">
              <div className="pin-toggle-header">
                <Pin size={14} className="pin-toggle-icon" />
                <label htmlFor="notice-important" className="pin-toggle-label">
                  Mark as High Priority Pinned Announcement
                </label>
              </div>
              <p className="pin-toggle-desc">
                Pins this bulletin to the top of the community board and highlights it on the resident dashboard.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="notice-form-actions">
            <Link to="/notices" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              id="notice-submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Publish Announcement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
