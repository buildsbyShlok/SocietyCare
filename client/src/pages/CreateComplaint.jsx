import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  FileText,
  Clock,
  Layers,
  Tag,
  Flag,
  FileCheck,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import { complaints as complaintsApi, ai as aiApi } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { PRIORITY, CATEGORY_LABELS, PRIORITY_LABELS } from '../utils/constants';
import AIAssistantPanel from '../components/AIAssistantPanel';
import DuplicateDetector from '../components/DuplicateDetector';
import './CreateComplaint.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const INITIAL_FORM = {
  title: '',
  description: '',
  category: '',
  priority: PRIORITY.MEDIUM,
};

// ─── Client-side Validation ───────────────────────────────────────────────────
function validate(form, photo) {
  const errors = {};

  const title = form.title.trim();
  if (!title || title.length < 5) {
    errors.title = 'Title must be at least 5 characters';
  } else if (title.length > 100) {
    errors.title = 'Title must not exceed 100 characters';
  }

  const desc = form.description.trim();
  if (!desc || desc.length < 10) {
    errors.description = 'Description must be at least 10 characters';
  } else if (desc.length > 2000) {
    errors.description = 'Description must not exceed 2000 characters';
  }

  if (!form.category) {
    errors.category = 'Please select an issue category';
  }

  if (!form.priority) {
    errors.priority = 'Please specify priority level';
  }

  if (photo) {
    if (!ACCEPTED_TYPES.includes(photo.type)) {
      errors.photo = 'Only JPEG, PNG, and WebP images are accepted';
    } else if (photo.size > MAX_SIZE_BYTES) {
      errors.photo = 'Image size must be smaller than 5 MB';
    }
  }

  return errors;
}

/**
 * CreateComplaint — Resident Issue Submission Workspace
 */
export default function CreateComplaint() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitted, setSubmitted] = useState(null);

  const fileInputRef = useRef(null);

  // ── AI Assistant state ──────────────────────────────────────────────────────
  const [aiStatus, setAiStatus] = useState('idle'); // 'idle' | 'loading' | 'result' | 'error'
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiDismissed, setAiDismissed] = useState(false);
  const aiDebounceRef = useRef(null);
  const AI_MIN_CHARS = 30;
  const AI_DELAY_MS = 1500;

  // ── Duplicate Detection state ───────────────────────────────────────────────
  const [dupStatus, setDupStatus] = useState('idle'); // 'idle' | 'checking' | 'found'
  const [dupMatches, setDupMatches] = useState([]);

  // ── Success Banner ──────────────────────────────────────────────────────────
  const [successBanner, setSuccessBanner] = useState('');

  // Clean up photo preview URL on change / unmount
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // ── Field Change Handler ───────────────────────────────────────────────────
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  // ── Debounced AI Trigger ────────────────────────────────────────────────────
  useEffect(() => {
    const description = form.description.trim();

    if (aiDismissed || description.length < AI_MIN_CHARS) {
      if (description.length < AI_MIN_CHARS && aiStatus === 'loading') {
        setAiStatus('idle');
        clearTimeout(aiDebounceRef.current);
      }
      return;
    }

    clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(() => {
      if (aiStatus === 'idle') {
        runAiAnalysis(description);
      }
    }, AI_DELAY_MS);

    return () => clearTimeout(aiDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.description]);

  async function runAiAnalysis(text) {
    setAiStatus('loading');
    setAiError(null);
    setAiSuggestions(null);
    try {
      const response = await aiApi.analyze(text || form.description.trim(), token);
      setAiSuggestions(response.data);
      setAiStatus('result');
    } catch (err) {
      setAiError(err.message || 'AI analysis temporarily unavailable.');
      setAiStatus('error');
    }
  }

  function handleAcceptSuggestions() {
    if (!aiSuggestions) return;
    setForm((prev) => ({
      ...prev,
      title: aiSuggestions.title || prev.title,
      description: aiSuggestions.refinedDescription || prev.description,
      category: aiSuggestions.category || prev.category,
      priority: aiSuggestions.priority || prev.priority,
    }));
    setFieldErrors((prev) => ({ ...prev, title: '', description: '', category: '', priority: '' }));
    setAiStatus('idle');
    setAiSuggestions(null);
    setAiDismissed(true);
    setSuccessBanner('AI suggestions applied successfully.');
    setTimeout(() => setSuccessBanner(''), 4000);
  }

  function handleDismissAI() {
    setAiStatus('idle');
    setAiSuggestions(null);
    setAiError(null);
    setAiDismissed(true);
  }

  function handleRetryAI() {
    setAiDismissed(false);
    runAiAnalysis(form.description.trim());
  }

  // ── File & Drag-and-Drop Handlers ──────────────────────────────────────────
  function processSelectedFile(file) {
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        photo: 'Invalid format. Please upload JPEG, PNG, or WebP.',
      }));
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        photo: 'File exceeds 5 MB limit. Please choose a smaller image.',
      }));
      return;
    }

    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFieldErrors((prev) => ({ ...prev, photo: '' }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0] || null;
    processSelectedFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFieldErrors((prev) => ({ ...prev, photo: '' }));
  }

  function resetForm() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setForm(INITIAL_FORM);
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFieldErrors({});
    setApiError('');
    setSubmitted(null);
    setAiStatus('idle');
    setAiSuggestions(null);
    setAiError(null);
    setAiDismissed(false);
    setDupStatus('idle');
    setDupMatches([]);
    setSuccessBanner('');
    setUploadProgress(0);
  }

  // ── Submission Logic ───────────────────────────────────────────────────────
  async function performSubmit() {
    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('description', form.description.trim());
    formData.append('category', form.category);
    formData.append('priority', form.priority);
    if (photo) formData.append('photo', photo);

    setSubmitting(true);
    setUploadProgress(40);

    try {
      setUploadProgress(75);
      const data = await complaintsApi.create(formData, token);
      setUploadProgress(100);
      setSubmitted(data.complaint);
    } catch (err) {
      setUploadProgress(0);
      if (err.errors && err.errors.length > 0) {
        setApiError(err.errors.join(' · '));
      } else {
        setApiError(err.message || 'Failed to submit complaint. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    const errors = validate(form, photo);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Check for duplicates before finalizing
    setDupStatus('checking');
    setDupMatches([]);
    const combinedText = `${form.title} ${form.description}`.trim();

    try {
      const response = await aiApi.detectDuplicates(combinedText, token);
      const matches = response.data || [];

      if (matches.length > 0) {
        setDupMatches(matches);
        setDupStatus('found');
        return;
      }

      setDupStatus('idle');
      await performSubmit();
    } catch (err) {
      console.warn('[Duplicate Check] Skipped:', err.message);
      setDupStatus('idle');
      await performSubmit();
    }
  }

  async function handleContinueAnyway() {
    setDupStatus('idle');
    setDupMatches([]);
    await performSubmit();
  }

  function handleEditComplaint() {
    setDupStatus('idle');
    setDupMatches([]);
  }

  // ── Success View ───────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="page create-complaint-page">
        <motion.div
          className="card complaint-success"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="complaint-success-icon-box" aria-hidden="true">
            <CheckCircle2 size={36} />
          </div>

          <h1 className="complaint-success-title">Complaint sent</h1>

          <div className="complaint-ref-badge">
            <span className="complaint-ref-label">Reference</span>
            <code className="complaint-ref-code">#{submitted.id.slice(-6)}</code>
          </div>

          <p className="complaint-success-message">
            Your maintenance request has been submitted to society operations. You can track progress,
            review activity logs, and receive updates directly from your dashboard.
          </p>

          <div className="complaint-success-actions">
            <Link to={`/complaints/${submitted.id}`} className="btn btn-primary">
              <FileCheck size={15} />
              <span>View complaint</span>
            </Link>
            <button onClick={resetForm} className="btn btn-secondary" type="button">
              <PlusCircle size={15} />
              <span>Report another issue</span>
            </button>
            <Link to="/complaints" className="btn btn-secondary">
              <span>My complaints</span>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main Form View ─────────────────────────────────────────────────────────
  return (
    <div className="page create-complaint-page">
      {/* Back Navigation */}
      <div className="back-navigation-container">
        <Link to="/complaints" className="complaint-back-link">
          <ArrowLeft size={14} />
          <span>My complaints</span>
        </Link>
      </div>

      {/* Header */}
      <header className="page-header">
        <div className="page-header-title">
          <h1>Report an issue</h1>
          <p className="page-header-subtitle">
            Tell the committee what needs fixing. You can follow every update from your complaints list.
          </p>
        </div>
      </header>

      <motion.div
        className="card create-complaint-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <form onSubmit={handleSubmit} noValidate>
          {/* Notifications */}
          <AnimatePresence>
            {successBanner && (
              <motion.div
                className="alert alert-success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                <CheckCircle2 size={16} />
                <span>{successBanner}</span>
              </motion.div>
            )}

            {apiError && (
              <motion.div
                className="alert alert-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
              >
                <AlertCircle size={16} />
                <span>{apiError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Field: Title */}
          <div className="form-group">
            <label htmlFor="complaint-title" className="form-label">
              Title <span className="text-danger">*</span>
            </label>
            <input
              id="complaint-title"
              name="title"
              type="text"
              className={`form-input${fieldErrors.title ? ' is-error' : ''}`}
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Water leaking from hallway ceiling pipe"
              maxLength={100}
              disabled={submitting}
              autoComplete="off"
            />
            {fieldErrors.title && <p className="form-error">{fieldErrors.title}</p>}
          </div>

          {/* Form Field: Category & Priority Selection */}
          <div className="complaint-form-row">
            <div className="form-group">
              <label htmlFor="complaint-category" className="form-label">
                Category <span className="text-danger">*</span>
              </label>
              <select
                id="complaint-category"
                name="category"
                className={`form-select${fieldErrors.category ? ' is-error' : ''}`}
                value={form.category}
                onChange={handleChange}
                disabled={submitting}
              >
                <option value="">Choose a category</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {fieldErrors.category && <p className="form-error">{fieldErrors.category}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="complaint-priority" className="form-label">
                Priority <span className="text-danger">*</span>
              </label>
              <select
                id="complaint-priority"
                name="priority"
                className={`form-select${fieldErrors.priority ? ' is-error' : ''}`}
                value={form.priority}
                onChange={handleChange}
                disabled={submitting}
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} Priority
                  </option>
                ))}
              </select>
              {fieldErrors.priority && <p className="form-error">{fieldErrors.priority}</p>}
            </div>
          </div>

          {/* Form Field: Description with Integrated AI Drawer */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="complaint-description" className="form-label">
                Description <span className="text-danger">*</span>
              </label>
              <button
                type="button"
                className="ai-trigger-pill-btn"
                onClick={() => {
                  const desc = form.description.trim();
                  if (desc.length < AI_MIN_CHARS) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      description: `Type at least ${AI_MIN_CHARS} characters to trigger the AI Assistant.`,
                    }));
                  } else {
                    setAiDismissed(false);
                    runAiAnalysis(desc);
                  }
                }}
                disabled={submitting || aiStatus === 'loading'}
                title="Automatically improve title, classification & grammar"
              >
                <Sparkles size={13} className="sparkle-icon" />
                <span>{aiStatus === 'loading' ? 'Analyzing...' : 'AI Assist'}</span>
              </button>
            </div>

            <textarea
              id="complaint-description"
              name="description"
              className={`form-textarea${fieldErrors.description ? ' is-error' : ''}`}
              value={form.description}
              onChange={handleChange}
              placeholder="What is wrong, where exactly, when it started, and whether it is a safety risk."
              rows={5}
              disabled={submitting}
            />
            <div className="field-meta-row">
              {fieldErrors.description ? (
                <p className="form-error">{fieldErrors.description}</p>
              ) : (
                <span className="form-hint">Minimum 10 characters required</span>
              )}
              <span className="character-count-indicator">{form.description.length} / 2000</span>
            </div>
          </div>

          {/* ✨ AI Assistant Drawer / Suggestion Panel */}
          <AnimatePresence>
            {aiStatus !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <AIAssistantPanel
                  status={aiStatus}
                  suggestions={aiSuggestions}
                  error={aiError}
                  onAccept={handleAcceptSuggestions}
                  onDismiss={handleDismissAI}
                  onRetry={handleRetryAI}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Field: Enhanced Drag-and-Drop File Upload */}
          <div className="form-group file-upload-section">
            <label className="form-label">
              Photo <span className="text-muted">(Optional · JPG, PNG, WebP · Max 5 MB)</span>
            </label>

            <input
              ref={fileInputRef}
              id="complaint-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="file-upload-input"
              onChange={handlePhotoChange}
              disabled={submitting}
            />

            {!photo ? (
              <div
                className={`file-dropzone${isDragging ? ' is-dragging' : ''}${
                  fieldErrors.photo ? ' is-error' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload photo attachment. Click or drag and drop image here"
              >
                <div className="dropzone-icon-box">
                  <UploadCloud size={24} />
                </div>
                <div className="dropzone-text">
                  <p className="dropzone-primary-text">
                    <span className="text-accent font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="dropzone-secondary-text">PNG, JPG, or WebP up to 5 MB</p>
                </div>
              </div>
            ) : (
              <div className="file-preview-card">
                <div className="file-preview-media">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Selected attachment preview" className="file-preview-thumb" />
                  ) : (
                    <div className="file-preview-fallback">
                      <FileText size={20} />
                    </div>
                  )}
                </div>

                <div className="file-preview-details">
                  <span className="file-preview-name" title={photo.name}>
                    {photo.name}
                  </span>
                  <span className="file-preview-meta">
                    {(photo.size / (1024 * 1024)).toFixed(2)} MB · {photo.type.split('/')[1]?.toUpperCase()}
                  </span>
                </div>

                <button
                  type="button"
                  className="file-remove-btn"
                  onClick={clearPhoto}
                  disabled={submitting}
                  aria-label="Remove attached photo"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {fieldErrors.photo && <p className="form-error">{fieldErrors.photo}</p>}
          </div>

          {/* Simulated Upload Progress Bar during network flight */}
          {submitting && uploadProgress > 0 && (
            <div className="submission-progress-wrapper">
              <div className="progress-label-row">
                <span className="progress-label">Sending your complaint…</span>
                <span className="progress-percentage">{uploadProgress}%</span>
              </div>
              <progress className="upload-progress-bar" value={uploadProgress} max={100}>
                {uploadProgress}%
              </progress>
            </div>
          )}

          {/* 🔍 Duplicate Detector Panel */}
          <DuplicateDetector
            status={dupStatus}
            matches={dupMatches}
            onContinue={handleContinueAnyway}
            onEdit={handleEditComplaint}
          />

          {/* Form Actions */}
          <div className="complaint-form-actions">
            <Link to="/complaints" className="btn btn-secondary">
              Cancel
            </Link>

            {dupStatus !== 'found' && (
              <button
                type="submit"
                id="complaint-submit"
                className="btn btn-primary btn-submit"
                disabled={submitting || dupStatus === 'checking'}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border" />
                    <span>Sending…</span>
                  </>
                ) : dupStatus === 'checking' ? (
                  <>
                    <Clock size={14} className="spin-icon" />
                    <span>Checking for similar complaints…</span>
                  </>
                ) : (
                  <>
                    <PlusCircle size={15} />
                    <span>Send complaint</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
