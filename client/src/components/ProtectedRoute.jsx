import { lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

const Welcome = lazy(() => import('../pages/Welcome'));

/**
 * ProtectedRoute — guards all authenticated routes.
 *
 * Renders a loading state while the token is being validated.
 * Redirects to /login if unauthenticated.
 * Optionally enforces a specific role — redirects to /dashboard on mismatch.
 *
 * Usage (in App.jsx):
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 *   <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
 *     <Route path="/notices/new" element={<CreateNotice />} />
 *   </Route>
 *
 * @param {string} [requiredRole] - Optional role constraint ('ADMIN' | 'RESIDENT')
 */
export default function ProtectedRoute({ requiredRole }) {
  const location=useLocation();
  const { user, token, loading, sessionError, retrySession, logout } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading your society…
      </div>
    );
  }

  if (token && sessionError) {
    return (
      <div className="loading-screen session-error" role="alert">
        <h1>We couldn’t restore your session</h1>
        <p>{sessionError}</p>
        <div className="session-error-actions">
          <button className="btn btn-primary" onClick={retrySession}>Try again</button>
          <button className="btn btn-secondary" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return location.pathname === '/' ? <Welcome/> : <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout />;
}
