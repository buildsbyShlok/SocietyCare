import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Box, MapPin, Plus, ArrowUpRight, ArrowLeft, Pencil, Download, Printer, Trash2 } from 'lucide-react';
import { reportUrl as createReportUrl } from '../utils/report-url.mjs';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { useResource, Load } from '../components/Workspace';
import { request } from '../api';
import './Assets.css';
import AssetComplaintHistory from '../components/AssetComplaintHistory';
import Dialog from '../components/Dialog';

const assetPath = id => '/assets/' + encodeURIComponent(id);
const date = value => new Date(value).toLocaleDateString([], { dateStyle: 'medium' });
export function AssetStatus({ status }) {
  return <span className={'asset-status ' + (status === 'ACTIVE' ? 'is-active' : 'is-inactive')}>
    <span aria-hidden="true" />{status === 'ACTIVE' ? 'Active' : 'Inactive'}
  </span>;
}

export default function Assets() {
  const [page, setPage] = useState(1);
  const source = useResource('/assets?page=' + page);
  return <div className="page ws-page asset-page">
    <header className="page-header">
      <div><h1>Asset Management</h1><p>Keep your society’s equipment and its QR labels in one place.</p></div>
      <Link to="/assets/new" className="btn btn-primary"><Plus size={18} />Add New Asset</Link>
    </header>
    <Load source={source}>{data => <>
      <p className="ws-muted">{data.total} {data.total === 1 ? 'asset' : 'assets'} registered</p>
      {data.items.length ? <div className="asset-grid">{data.items.map(asset =>
        <Link className="asset-card" to={assetPath(asset.id)} key={asset.id}>
          <div className="asset-card-top"><Box size={26} aria-hidden="true" /><AssetStatus status={asset.status} /></div>
          <span className="asset-code">{asset.assetCode}</span>
          <h2>{asset.name}</h2>
          <p className="asset-location"><MapPin size={16} aria-hidden="true" />{asset.location}</p>
          <div className="asset-card-bottom"><span>{asset.category}</span><ArrowUpRight size={18} aria-hidden="true" /></div>
        </Link>
      )}</div> : <div className="asset-empty"><Box size={36} aria-hidden="true" /><h2>No assets registered yet</h2><p>Add your first asset to create its equipment record and QR label.</p><Link className="btn btn-secondary" to="/assets/new">Add New Asset</Link></div>}
      {(page > 1 || data.hasNext) && <nav className="event-pagination" aria-label="Asset pages">
        <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="btn btn-secondary" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>Next</button>
      </nav>}
    </>}</Load>
  </div>;
}

export function AssetDetail() {
  const { id } = useParams();
  const source = useResource(assetPath(id));
  return <div className="page ws-page asset-page asset-detail-page">
    <Link className="asset-back" to="/assets"><ArrowLeft size={16} />Back to assets</Link>
    <Load source={source}>{asset => <AssetRecord key={asset.id + asset.updatedAt} asset={asset} onChange={source.retry} />}</Load>
  </div>;
}

function AssetRecord({ asset, onChange }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [deleting, setDeleting] = useState(false), [deleteOpen, setDeleteOpen] = useState(false), [error, setError] = useState('');
  async function changeStatus() {
    const next = asset.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(next === 'INACTIVE' ? 'Deactivate this asset? Its record and QR token will be preserved.' : 'Activate this asset?')) return;
    if (busy) return;
    setBusy(true); setError('');
    try { await request('PATCH', assetPath(asset.id) + '/status', { status: next }, token); onChange(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function deleteAsset() {
    if (deleting) return;
    setDeleting(true); setError('');
    try {
      await request('DELETE', assetPath(asset.id), null, token);
      navigate('/assets', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to delete this asset.');
      setDeleteOpen(false);
    } finally { setDeleting(false); }
  }
  return <>
    <header className="page-header">
      <div><h1>{asset.name}</h1><p className="asset-code">{asset.assetCode}</p></div>
      <div className="ws-inline"><AssetStatus status={asset.status} /><Link className="btn btn-secondary" to={assetPath(asset.id) + '/edit'}><Pencil size={16} />Edit asset</Link></div>
    </header>
    <div className="asset-detail-grid">
      <section className="asset-information" aria-labelledby="asset-info-title">
        <h2 id="asset-info-title">Equipment record</h2>
        <dl className="asset-facts"><div><dt>Location</dt><dd>{asset.location}</dd></div><div><dt>Category</dt><dd>{asset.category}</dd></div><div><dt>Added</dt><dd>{date(asset.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{date(asset.updatedAt)}</dd></div></dl>
        <h2>Description</h2><p className="asset-description">{asset.description || 'No description added.'}</p>
        <div className="asset-availability"><h2>Availability</h2><p className="ws-muted">Deactivate equipment that is no longer in service. Its record and QR token are retained.</p>
          <button className="btn btn-secondary" disabled={busy} onClick={changeStatus}>{busy ? 'Saving…' : asset.status === 'ACTIVE' ? 'Deactivate asset' : 'Activate asset'}</button>
          {error && <p role="alert" className="ws-feedback">{error}</p>}
        </div>
        <div className="asset-danger-zone"><h2>Delete asset</h2><p className="ws-muted">Deletion is available only when this asset has no linked complaint history. Assets with reports must remain deactivated so the audit trail stays intact.</p><button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)} disabled={deleting}><Trash2 size={16} />Delete asset</button></div>
      </section>
      <AssetQR asset={asset} />
    </div>
    <AssetComplaintHistory assetId={asset.id} />
    <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} label={'Delete ' + asset.name} className="asset-delete-dialog">
      <div className="asset-delete-dialog-content">
        <h2>Delete asset?</h2>
        <p>This removes <strong>{asset.name}</strong> from Asset Management. Linked complaint history is never removed; if any exists, deletion will be blocked and you can deactivate the asset instead.</p>
        <div className="ws-inline"><button type="button" className="btn btn-secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={deleting} onClick={deleteAsset}>{deleting ? 'Deleting…' : 'Delete asset'}</button></div>
      </div>
    </Dialog>
  </>;
}

export function AssetQR({ asset }) {
  const [rendered, setRendered] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  let reportUrl, configurationError;
  try {
    reportUrl = createReportUrl(asset.qrToken, import.meta.env.VITE_PUBLIC_FRONTEND_URL, window.location.origin, import.meta.env.PROD);
  } catch (cause) {
    configurationError = cause.message;
  }
  const image = rendered?.url === reportUrl ? rendered?.image : null;
  useEffect(() => {
    let current = true;
    setRendered(null); setError('');
    if (!reportUrl) return;
    QRCode.toDataURL(reportUrl, { width: 768, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(url => { if (current) setRendered({ url: reportUrl, image: url }); })
      .catch(() => { if (current) setError('Could not generate the QR image. Please try again.'); });
    return () => { current = false; };
  }, [reportUrl, attempt]);
  if (configurationError) return <p role="alert" className="ws-feedback">{configurationError}</p>;
  return <section className="asset-qr" aria-labelledby="asset-qr-title">
    <h2 id="asset-qr-title">QR label</h2>
    <div className="asset-print-label">
      <p className="asset-print-brand">SocietyCare · Equipment label</p>
      <h3>{asset.name}</h3><p>{asset.assetCode} · {asset.location}</p>
      {image ? <img src={image} width="280" height="280" alt={'QR code for reporting a fault on ' + asset.name} /> : <p role="status">{error ? 'QR unavailable' : 'Generating QR…'}</p>}
      <p className="asset-qr-url">{reportUrl}</p>
      <p>Scan to report a fault. Sign in with your resident account.</p>
    </div>
    {error && <div role="alert" className="ws-feedback">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry</button></div>}
    <div className="asset-qr-actions">
      {image && <a className="btn btn-secondary" href={image} download={asset.assetCode + '-QR.png'}><Download size={16} />Download PNG</a>}
      <button className="btn btn-secondary" disabled={!image} onClick={() => window.print()}><Printer size={16} />Print QR</button>
    </div>
    <p className="ws-muted">Verify the reporting address before installing printed labels.</p>
  </section>;
}

export function AssetEditor() {
  const { id } = useParams();
  const source = useResource(id ? assetPath(id) : null);
  return <div className="page ws-page asset-page">
    <Link className="asset-back" to={id ? assetPath(id) : '/assets'}><ArrowLeft size={16} />{id ? 'Back to asset' : 'Back to assets'}</Link>
    <header className="page-header"><div><h1>{id ? 'Edit asset' : 'Add New Asset'}</h1><p>{id ? 'Update equipment details. The QR token stays the same.' : 'Register equipment and generate its unique QR label.'}</p></div></header>
    {id ? <Load source={source}>{asset => <AssetForm key={asset.id} asset={asset} />}</Load> : <AssetForm />}
  </div>;
}

function AssetForm({ asset }) {
  const { token } = useAuth(), navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const result = await request(asset ? 'PUT' : 'POST', asset ? assetPath(asset.id) : '/assets', data, token);
      navigate(assetPath(result.id));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="ws-form asset-form" onSubmit={save}>
    <label>Asset name<input name="name" required maxLength={120} defaultValue={asset?.name} autoComplete="off" /></label>
    <label>Asset code<input name="assetCode" required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" defaultValue={asset?.assetCode} aria-describedby="asset-code-help" autoComplete="off" /><small id="asset-code-help">Unique code using letters, numbers, hyphens or underscores. Saved in uppercase.</small></label>
    <label>Location<input name="location" required maxLength={240} defaultValue={asset?.location} /></label>
    <label>Category<input name="category" required maxLength={80} defaultValue={asset?.category} /></label>
    <label>Description (optional)<textarea name="description" rows={5} maxLength={2000} defaultValue={asset?.description} /></label>
    {error && <p role="alert" className="ws-feedback">{error}</p>}
    <div className="ws-inline"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : asset ? 'Save changes' : 'Create asset'}</button><Link className="btn btn-secondary" to={asset ? assetPath(asset.id) : '/assets'}>Cancel</Link></div>
  </form>;
}
