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
export function Brand({ size = 32 }) {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="var(--color-accent)" />
      <g fill="var(--color-on-accent)">
        <rect x="9.5" y="17" width="6" height="14" rx="1.2" />
        <rect x="17" y="9" width="6" height="22" rx="1.2" />
        <rect x="24.5" y="13" width="6" height="18" rx="1.2" />
      </g>
    </svg>
  );
}
