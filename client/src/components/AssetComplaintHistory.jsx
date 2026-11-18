import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource, Load } from './Workspace';
import { StatusBadge } from './StatusBadge';
import ComplaintSource from './ComplaintSource';
import { formatDate } from '../utils/helpers';

export default function AssetComplaintHistory({ assetId }) {
  const [page, setPage] = useState(1);
  const source = useResource('/assets/' + encodeURIComponent(assetId) + '/complaints?page=' + page);
  return <section className="asset-complaint-history" aria-labelledby="asset-history-heading">
    <header><h2 id="asset-history-heading">Complaint History</h2><Link to={'/complaints?assetId=' + encodeURIComponent(assetId)}>Open complaint board</Link></header>
    <p className="ws-muted">Includes archived complaints. Removed complaints are excluded.</p>
    <Load source={source}>{data => <>
      <dl className="asset-history-summary">{[['Total', data.totalItems], ['Open', data.byStatus.OPEN], ['In progress', data.byStatus.IN_PROGRESS], ['Resolved', data.byStatus.RESOLVED]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
      {data.items.length ? <ul className="asset-history-list">{data.items.map(complaint => <li key={complaint.id}>
        <Link to={'/complaints/' + complaint.id}><span><strong>{complaint.title}</strong><small>{complaint.resident?.name || 'Deleted resident'} · {formatDate(complaint.createdAt)}{complaint.archivedAt ? ' · Archived' : ''}</small></span><span className="asset-history-badges"><ComplaintSource source={complaint.source} /><StatusBadge status={complaint.status} /></span></Link>
      </li>)}</ul> : <p className="asset-history-empty">No complaints have been reported for this asset.</p>}
      {(data.hasPreviousPage || data.hasNextPage) && <nav className="event-pagination" aria-label="Asset complaint history pages"><button className="btn btn-secondary" disabled={!data.hasPreviousPage} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {data.currentPage} of {data.totalPages}</span><button className="btn btn-secondary" disabled={!data.hasNextPage} onClick={() => setPage(n => n + 1)}>Next</button></nav>}
    </>}</Load>
  </section>;
}
