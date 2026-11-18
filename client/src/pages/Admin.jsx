import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Megaphone, MessagesSquare, Users, Boxes } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Load, useResource } from '../components/Workspace';
import { request } from '../api';
import './Admin.css';

const tools = [
  { title: 'Resident directory', detail: 'Profiles, unit details and account access', to: '/settings/users', icon: Users },
  { title: 'Asset management', detail: 'Equipment records, QR labels and reporting history', to: '/assets', icon: Boxes },
  { title: 'Notice board', detail: 'Publish, pin and maintain society announcements', to: '/notices', icon: Megaphone },
  { title: 'Community moderation', detail: 'Review reports and manage community messages', to: '/community?view=reports', icon: MessagesSquare },
];
export default function Admin() {
  const { token } = useAuth(),
    [rev, setRev] = useState(0),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState('');
  const society = useResource('/society', rev);
  async function save(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setFeedback('');
    try {
      await request('PATCH', '/society', body, token);
      setFeedback('Society information saved.');
      setRev((n) => n + 1);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page ws-page admin-page">
      <header className="admin-page-heading">
        <div>
          <h1>Admin management</h1>
          <p>Manage people, communications and shared society information.</p>
        </div>
      </header>
      <div className="admin-layout">
        <section className="admin-tools" aria-labelledby="admin-tools-heading">
          <h2 id="admin-tools-heading">Management areas</h2>
          <div className="admin-tool-list">
            {tools.map(({ title, detail, to, icon: Icon }) => (
              <Link key={to} to={to} className="admin-tool-row">
                <Icon size={19} aria-hidden="true" />
                <span><strong>{title}</strong><small>{detail}</small></span>
              </Link>
            ))}
          </div>
        </section>
        <section className="admin-society-panel" aria-labelledby="society-information-heading">
          <header><Building2 size={19} aria-hidden="true" /><div><h2 id="society-information-heading">Society information</h2><p>Only administrators can update these shared details.</p></div></header>
          <Load source={society}>
            {({ society: s }) => (
              <form className="ws-form admin-society-form" onSubmit={save}>
                <label>
                  Society name
                  <input name="name" maxLength={100} required defaultValue={s?.name} />
                </label>
                <label>
                  Address
                  <input name="address" maxLength={240} defaultValue={s?.address} />
                </label>
                <label>
                  Society description
                  <textarea name="description" maxLength={800} defaultValue={s?.description} />
                </label>
                <label>
                  Total flats (if known)
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    name="totalFlats"
                    defaultValue={s?.totalFlats}
                  />
                </label>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save society information'}
                </button>
              </form>
            )}
          </Load>
          {feedback && (
            <p className="ws-feedback" role="status">
              {feedback}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
