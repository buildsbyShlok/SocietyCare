import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { users as usersApi } from "../api/index";
import { Link } from "react-router-dom";
import "./Settings.css";
import { ResidentRecord } from "../components/ResidentRecord";

export default function Settings() {
  const { user, token, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [flatNumber, setFlatNumber] = useState(user?.flatNumber || "");
  const [tower, setTower] = useState(user?.tower || "");
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null);

  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!avatar) return;
    const url = URL.createObjectURL(avatar);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setFieldErrors((prev) => ({
          ...prev,
          avatar: "Only JPEG, PNG, and WebP images are accepted.",
        }));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setFieldErrors((prev) => ({
          ...prev,
          avatar: "File size must be smaller than 2 MB.",
        }));
        return;
      }

      setFieldErrors((prev) => ({ ...prev, avatar: "" }));
      setAvatar(file);
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    setApiSuccess("");
    setFieldErrors({});

    const errors = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }
    if (!flatNumber.trim()) {
      errors.flatNumber = "Flat number is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("phone", phone ? phone.trim() : "");
    formData.append("flatNumber", flatNumber.trim());
    formData.append("tower", tower.trim());
    if (avatar) {
      formData.append("avatar", avatar);
    }

    try {
      const response = await usersApi.updateProfile(formData, token);
      updateUser(response.data);
      setAvatar(null);
      setAvatarPreview(response.data.avatarUrl || null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setApiSuccess("Profile updated successfully.");
      setTimeout(() => setApiSuccess(""), 4000);
    } catch (err) {
      setApiError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page settings-page animate-fade-in">
      <header className="page-header">
        <div className="page-header-title">
          <h1>My profile</h1>
          <p className="page-header-subtitle">
            Your name, contact details and photo. Society-wide details are managed by an administrator.
          </p>
        </div>
      </header>

      {/* Settings Navigation Tabs */}
      <div className="settings-tabs">
        <Link to="/settings" className="settings-tab active" aria-current="page">
          My profile
        </Link>
        {isAdmin && (
          <Link to="/settings/users" className="settings-tab">
            Resident directory
          </Link>
        )}
      </div>

      <div className="card settings-card">
        <form onSubmit={handleSubmit} noValidate className="settings-form">
          <h2 className="settings-section-title">Profile details</h2>

          {apiSuccess && (
            <div
              className="alert alert-success"
              role="alert"
              style={{ marginBottom: "var(--space-4)" }}
            >
              {apiSuccess}
            </div>
          )}

          {apiError && (
            <div
              className="alert alert-error"
              role="alert"
              style={{ marginBottom: "var(--space-4)" }}
            >
              {apiError}
            </div>
          )}

          {/* Avatar Upload Block */}
          <div className="avatar-upload-container">
            <button
              type="button"
              className="avatar-preview-wrapper"
              onClick={triggerFileInput}
              disabled={submitting}
              aria-label="Change profile photo"
              aria-describedby={
                fieldErrors.avatar
                  ? "settings-avatar-help settings-avatar-error"
                  : "settings-avatar-help"
              }
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={name ? name + " profile photo" : "Profile photo"}
                  className="avatar-preview-image"
                />
              ) : (
                <div className="avatar-preview-placeholder">
                  {name.trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="avatar-hover-overlay">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Upload</span>
              </div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              disabled={submitting}
            />
            <div className="avatar-upload-info">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-describedby={fieldErrors.avatar ? "settings-avatar-help settings-avatar-error" : "settings-avatar-help"}
                onClick={triggerFileInput}
                disabled={submitting}
              >
                Change photo
              </button>
              <p
                id="settings-avatar-help"
                className="avatar-upload-constraints"
              >
                JPEG, PNG, or WebP · Max 2 MB
              </p>
              {fieldErrors.avatar && (
                <p id="settings-avatar-error" className="form-error">
                  {fieldErrors.avatar}
                </p>
              )}
            </div>
          </div>

          <div className="settings-fields-grid">
            {/* Full name */}
            <div className="form-group">
              <label htmlFor="settings-name" className="form-label">
                Full name
              </label>
              <input
                id="settings-name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? "settings-name-error" : undefined
                }
                type="text"
                className={`form-input${fieldErrors.name ? " is-error" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
              {fieldErrors.name && (
                <p id="settings-name-error" className="form-error">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email (Read-only) */}
            <div className="form-group">
              <label htmlFor="settings-email" className="form-label">
                Email address
              </label>
              <input
                id="settings-email"
                type="email"
                className="form-input"
                value={user.email}
                readOnly
                disabled
              />
              <p className="form-hint">Your sign-in email can’t be changed here.</p>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label htmlFor="settings-phone" className="form-label">
                Phone number
              </label>
              <input
                id="settings-phone"
                type="tel"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Flat Number */}
            <div className="form-group">
              <label htmlFor="settings-flat" className="form-label">
                Flat or unit number
              </label>
              <input
                id="settings-flat"
                aria-invalid={Boolean(fieldErrors.flatNumber)}
                aria-describedby={
                  fieldErrors.flatNumber ? "settings-flat-error" : undefined
                }
                type="text"
                className={`form-input${fieldErrors.flatNumber ? " is-error" : ""}`}
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                disabled={submitting}
              />
              {fieldErrors.flatNumber && (
                <p id="settings-flat-error" className="form-error">
                  {fieldErrors.flatNumber}
                </p>
              )}
            </div>

            <label className="form-group">
              Tower
              <input
                className="form-input"
                maxLength={60}
                value={tower}
                onChange={(e) => setTower(e.target.value)}
              />
            </label>
            {/* Role (Read-only) */}
            <div className="form-group">
              <label className="form-label">Role</label>
              <div className="read-only-badge">{user.role === "ADMIN" ? "Administrator" : "Resident"}</div>
            </div>

            {/* Member since (Read-only) */}
            <div className="form-group">
              <label className="form-label">Member since</label>
              <div className="read-only-value">
                {new Date(user.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          <div className="settings-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving changes..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
      <ResidentRecord id={user.id} />
    </div>
  );
}
