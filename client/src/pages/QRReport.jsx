import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Box, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { Brand } from '../components/Workspace';
import { useAuth } from '../context/AuthContext';
import { request } from '../api';
import { reportAuthPath } from '../utils/report-return';
import './QRReport.css';

export default function QRReport() {
  const { qrToken } = useParams(), location = useLocation();
  const { user, token, loading, sessionError, retrySession, logout } = useAuth();
  const [snapshot, setResult] = useState({}), [attempt, setAttempt] = useState(0);
  const result = snapshot.qrToken === qrToken ? snapshot : {};
  const returnTo = location.pathname + location.search + location.hash;
  useEffect(() => {
    let current = true;
    setResult({});
    request('GET', '/assets/qr/' + encodeURIComponent(qrToken))
      .then(asset => { if (current) setResult({ qrToken, asset }); })
      .catch(error => { if (current) setResult({ qrToken, error }); });
    return () => { current = false; };
  }, [qrToken, attempt]);
  return <main className="qr-report-page">
    <header className="qr-report-header"><Link to="/" aria-label="SocietyCare Home"><Brand /><strong>SocietyCare</strong></Link><span>Equipment support</span></header>
    <div className="qr-report-content">
      {result.error ? <section className="qr-report-message" role="alert"><h1>Equipment unavailable</h1><p>{result.error.message}</p><p>Check the QR label or contact society management.</p>{![404, 410].includes(result.error.status) && <button className="btn btn-secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button>}<Link className="btn btn-secondary" to="/">Go to SocietyCare</Link></section>
      : !result.asset ? <p role="status">Loading equipment…</p>
      : <>
        <section className="qr-machine" aria-label="Equipment identification"><Box size={30} aria-hidden="true" /><div><h1>{result.asset.name}</h1><p className="qr-machine-code">{result.asset.assetCode} · {result.asset.category}</p><p className="qr-machine-location"><MapPin size={16} aria-hidden="true" />{result.asset.location}</p></div></section>
        {loading ? <p role="status">Checking your session…</p>
        : token && sessionError ? <div role="alert" className="qr-report-message"><p>{sessionError}</p><button className="btn btn-primary" onClick={retrySession}>Retry session</button><button className="btn btn-secondary" onClick={logout}>Sign out</button></div>
        : !user || !token ? <section className="qr-report-message"><h2>Report an equipment fault</h2><p>Sign in with your society’s resident account to send a complaint and track its progress.</p><div className="qr-report-actions"><Link className="btn btn-primary" to={reportAuthPath('/login', returnTo)}>Sign in to report<ArrowRight size={16} /></Link><Link className="btn btn-secondary" to={reportAuthPath('/register', returnTo)}>Register as a resident</Link></div></section>
        : user.role !== 'RESIDENT' ? <section className="qr-report-message" role="alert"><h2>Resident account required</h2><p>Admin accounts cannot submit resident complaints. Use a resident account to report this equipment.</p><button className="btn btn-secondary" onClick={logout}>Sign out</button></section>
        : <QRComplaintForm key={qrToken + user.id} qrToken={qrToken} asset={result.asset} token={token} />}
      </>}
    </div>
  </main>;
}

export function QRComplaintForm({ qrToken, asset, token }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [submitted, setSubmitted] = useState(null);
  const [file, setFile] = useState(null), [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choosePhoto(event) {
    const selected = event.target.files?.[0]; setError('');
    if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024)) {
      setError('Choose a JPEG, PNG or WebP image up to 5 MB.'); event.target.value = ''; setFile(null); return;
    }
    setFile(selected || null);
  }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    if (data.get('title').trim().length < 5 || data.get('description').trim().length < 10) { setError('Enter a title of at least 5 characters and a description of at least 10 characters.'); return; }
    data.set('qrToken', qrToken);
    if (!file) data.delete('photo');
    setBusy(true); setError('');
    try { const response = await request('POST', '/complaints', data, token); setSubmitted(response.complaint); }
    catch (err) { setError(err.errors?.join(' · ') || err.message); }
    finally { setBusy(false); }
  }
  if (submitted) return <section className="qr-report-message qr-report-success" role="status"><CheckCircle2 size={36} aria-hidden="true" /><h2>Complaint submitted</h2><p>Your report for {asset.name} has been sent to society management. Follow status updates and remarks from your complaint page.</p><Link className="btn btn-primary" to={'/complaints/' + encodeURIComponent(submitted.id)}>View complaint<ArrowRight size={16} /></Link><Link className="btn btn-secondary" to="/complaints">My complaints</Link></section>;
  return <section className="qr-report-form"><h2>What needs attention?</h2><p>Describe the issue so your maintenance team can help.</p>
    <form className="ws-form" onSubmit={submit}>
      <label>Asset name<input readOnly value={asset.name} /></label>
      <label>Asset location<input readOnly value={asset.location} /></label>
      <label>Issue title<input name="title" required minLength={5} maxLength={100} disabled={busy} /></label>
      <label>Issue description<textarea name="description" required minLength={10} maxLength={2000} rows={5} disabled={busy} /></label>
      <label>Priority<select name="priority" defaultValue="MEDIUM" disabled={busy}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
      <label>Photo (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={busy} /><small>JPEG, PNG or WebP · up to 5 MB</small></label>
      {preview && <img className="qr-photo-preview" src={preview} alt="Selected issue photo" />}
      {error && <p role="alert" className="ws-feedback">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting complaint…' : 'Submit Complaint'}</button>
      <p className="qr-report-note">Equipment details come from this QR label and cannot be changed here.</p>
    </form>
  </section>;
}
