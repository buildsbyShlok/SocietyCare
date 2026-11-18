import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { request } from '../api';
import { useAuth } from '../context/AuthContext';

export function useResource(path, revision = 0) {
  const { token } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const key = [path, token, revision, attempt].join('|');
  const [result, setResult] = useState({});
  useEffect(() => {
    let current = true;
    if (path)
      request('GET', path, null, token)
        .then((data) => {
          if (current) setResult({ key, data });
        })
        .catch((error) => {
          if (current) setResult({ key, error: error.message });
        });
    return () => {
      current = false;
    };
  }, [path, token, key]);
  return { ...(result.key === key ? result : {}), retry: () => setAttempt((n) => n + 1) };
}
export function Load({ source, children }) {
  if (source.error)
    return (
      <div role="alert" className="ws-feedback">
        {source.error} <button onClick={source.retry}>Retry</button>
      </div>
    );
  if (!source.data)
    return (
      <p role="status" className="ws-muted">
        Loading…
      </p>
    );
  return children(source.data);
}
export function Section({ title, action, children }) {
  return (
    <section className="ws-section">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Row({ to, title, detail, meta }) {
  const content = (
    <>
      <span>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className="ws-meta">
        {meta}
        {to && <ChevronRight size={14} />}
      </span>
    </>
  );
  return to ? (
    <Link className="ws-row" to={to}>
      {content}
    </Link>
  ) : (
    <div className="ws-row">{content}</div>
  );
}
export function Brand() {
  return (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="var(--color-accent-light)" />
      <path
        d="m7 27 8-4V13l9-5 9 5v15l-9 5-8-5-9 4z"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
      />
      <path d="m16 13 8 5 9-5m-9 5v15m-14-5 7-4" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
    </svg>
  );
}
