import AuthShell from '../components/AuthShell';
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { safeReportReturn, reportAuthPath } from '../utils/report-return';
import { auth as authApi } from '../api/index';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';
import './Auth.css';

// ─── Client-side validation ───────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errors = {};

  if (!form.name.trim() || form.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(form.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (!form.password || form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (form.name.trim().length > 100) errors.name = 'Name must not exceed 100 characters';
  if (form.email.length > 254) errors.email = 'Email must not exceed 254 characters';
  if (form.flatNumber.trim().length > 40) errors.flatNumber = 'Flat number must not exceed 40 characters';
  if (new TextEncoder().encode(form.password).length > 72) errors.password = 'Password must not exceed 72 UTF-8 bytes';
  if (!form.role) {
    errors.role = 'Please select a role';
  }
  if (!form.flatNumber.trim()) {
    errors.flatNumber = 'Flat / unit number is required';
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Register page — creates a new resident account.
 *
 * State design:
 *   - `form`        — single object for all 6 fields (avoids 6 separate useState calls)
 *   - `fieldErrors` — per-field validation errors, cleared on change for that field
 *   - `apiError`    — top-level error string from the server response
 *   - `submitting`  — disables all inputs and shows loading label during the request
 *
 * Error handling:
 *   - Server may return a `message` string (e.g. 409 duplicate email)
 *   - Server may return an `errors` array (e.g. 400 validation failure that bypassed client checks)
 *   - Both cases are surfaced in the alert banner
 */
export default function Register() {
  const { user, loading: authLoading } = useAuth();
  const [receipt, setReceipt] = useState('');
  const location = useLocation();
  const returnTo = safeReportReturn(new URLSearchParams(location.search).get('returnTo'));

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES.RESIDENT,
    flatNumber: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors]   = useState({});
  const [apiError, setApiError]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // ── Early returns ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-hidden="true" style={{ marginBottom: 'var(--space-2)' }}></div>
        <span>Loading…</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear the specific field error as soon as the user edits it
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
      const qrToken = returnTo === '/' ? undefined : new URL(returnTo, window.location.origin).pathname.split('/').pop();
      const data = await authApi.register({ ...form, qrToken });
      setReceipt(data.message);
    } catch (err) {
      // Server returns either err.message (string) or err.errors (string[])
      if (err.errors && err.errors.length > 0) {
        setApiError(err.errors.join(' · '));
      } else {
        setApiError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthShell
      title="Request resident access"
      subtitle="Your society administrator verifies each request before you can sign in."
      footer={<>
        Already have an account?{' '}
          <Link to={reportAuthPath('/login', returnTo)}>Sign in</Link>
      </>}
    >

        {receipt ? <p role="status" className="alert alert-success">{receipt}</p> : <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {apiError && (
            <div className="auth-api-error" role="alert">
              {apiError}
            </div>
          )}

          {/* Full name ----------------------------------------------------- */}
          <div className="form-group">
            <label htmlFor="reg-name" className="form-label">
              Full name
            </label>
            <input
              id="reg-name"
              name="name"
              type="text"
              className={`form-input${fieldErrors.name ? ' is-error' : ''}`}
              value={form.name}
              onChange={handleChange}
              placeholder="Priya Sharma"
              autoComplete="name"
              disabled={submitting}
            />
            {fieldErrors.name && (
              <p className="form-error">{fieldErrors.name}</p>
            )}
          </div>

          {/* Email --------------------------------------------------------- */}
          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">
              Email address
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className={`form-input${fieldErrors.email ? ' is-error' : ''}`}
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={submitting}
            />
            {fieldErrors.email && (
              <p className="form-error">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password ------------------------------------------------------- */}
          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">
              Password
            </label>
            <div className="password-wrapper">
              <input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input${fieldErrors.password ? ' is-error' : ''}`}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={submitting}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="form-error">{fieldErrors.password}</p>
            )}
          </div>



          <div className="auth-row">
          {/* Flat Number --------------------------------------------------- */}
          <div className="form-group">
            <label htmlFor="reg-flat" className="form-label">
              Flat or unit number
            </label>
            <input
              id="reg-flat"
              name="flatNumber"
              type="text"
              className={`form-input${fieldErrors.flatNumber ? ' is-error' : ''}`}
              value={form.flatNumber}
              onChange={handleChange}
              placeholder="A-101"
              disabled={submitting}
            />
            {fieldErrors.flatNumber && (
              <p className="form-error">{fieldErrors.flatNumber}</p>
            )}
          </div>

          {/* Phone (optional) ---------------------------------------------- */}
          <div className="form-group">
            <label htmlFor="reg-phone" className="form-label">
              Phone number{' '}
              <span className="form-optional">Optional</span>
            </label>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={handleChange}
              placeholder="9876543210"
              autoComplete="tel"
              disabled={submitting}
            />
          </div>

          </div>

          {/* Submit --------------------------------------------------------- */}
          <button
            type="submit"
            id="register-submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting ? 'Requesting enrollment…' : 'Request enrollment'}
          </button>

        </form>}
    </AuthShell>
  );
}
