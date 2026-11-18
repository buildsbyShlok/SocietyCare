import { useRef, useState } from 'react';
import { Load, useResource } from './Workspace';
import './AssetComplaints.css';

// Fetch a small searchable page only while the picker is open, including inactive equipment.
export default function AssetFilter({ value, onChange }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), details = useRef(null);
  const source = useResource(open ? '/assets?options=true&limit=12&page=' + page + '&search=' + encodeURIComponent(search) : null);
  function choose(asset) { setSelected(asset); onChange(asset?.id || ''); details.current.open = false; }
  return <details className="asset-filter" ref={details} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary aria-label="Filter by asset">{value ? selected?.id === value ? selected.name : 'Selected asset' : 'All assets'}</summary>
    <div className="asset-filter-panel">
      <label>Find equipment<input type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <button className="btn btn-secondary" onClick={() => choose(null)}>All assets</button>
      {open && <Load source={source}>{data => <>
        <ul>{data.items.map(asset => <li key={asset.id}><button aria-pressed={value === asset.id} onClick={() => choose(asset)}><strong>{asset.name}</strong><small>{asset.assetCode} · {asset.status === 'ACTIVE' ? 'Active' : 'Inactive'}</small></button></li>)}</ul>
        {!data.items.length && <p>No matching assets.</p>}
        {(page > 1 || data.hasNext) && <div className="asset-filter-pages"><button disabled={page === 1} onClick={() => setPage(n => n - 1)}>Previous assets</button><button disabled={!data.hasNext} onClick={() => setPage(n => n + 1)}>Next assets</button></div>}
      </>}</Load>}
    </div>
  </details>;
}
