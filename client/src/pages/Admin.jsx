import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Load, Section, Row, useResource } from '../components/Workspace';
import { request } from '../api';
const tools = [
  ['Resident directory', 'Profiles, unit details and access', '/settings/users'],
  ['Complaint management', 'Review tickets and archive resolved work', '/complaints'],
  ['Notice management', 'Publish and pin announcements', '/notices'],
  ['Maintenance ledger', 'Issue invoices and verify payments', '/billing'],
  ['Community moderation', 'Review reports and remove messages', '/community?view=reports'],
];
export default function Admin() {
  const { token } = useAuth(),
    [rev, setRev] = useState(0),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(''),
    [page, setPage] = useState(1);
  const society = useResource('/society', rev),
    archived = useResource('/complaints?archived=true&page=' + page);
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
    <div className="page ws-page">
      <div className="ws-kicker">SOCIETYCARE / ADMINISTRATION</div>
      <h1>Admin management</h1>
      <div className="ws-columns">
        <div>
          <Section title="Management tools">
            {tools.map(([title, detail, to]) => (
              <Row key={to} to={to} title={title} detail={detail} />
            ))}
          </Section>
          <Section title="Complaint archive">
            <Load source={archived}>
              {(data) => (
                <>
                  {data.items.length ? (
                    data.items.map((c) => (
                      <Row
                        key={c.id}
                        to={'/complaints/' + c.id}
                        title={c.title}
                        detail={c.resident?.name || "Deleted account"}
                      />
                    ))
                  ) : (
                    <p>No archived complaints.</p>
                  )}
                  <div className="ws-inline">
                    {data.hasPreviousPage && (
                      <button onClick={() => setPage(page - 1)}>Previous</button>
                    )}
                    {data.hasNextPage && <button onClick={() => setPage(page + 1)}>Next</button>}
                  </div>
                </>
              )}
            </Load>
          </Section>
        </div>
        <Section title="Society information">
          <Load source={society}>
            {({ society: s }) => (
              <form className="ws-form" onSubmit={save}>
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
                <label>
                  Next maintenance
                  <textarea
                    name="upcomingMaintenance"
                    maxLength={500}
                    defaultValue={s?.upcomingMaintenance}
                  />
                </label>
                <label>
                  Scheduled date
                  <input
                    type="date"
                    name="maintenanceDate"
                    defaultValue={s?.maintenanceDate?.slice(0, 10)}
                  />
                </label>
                <button className="btn btn-primary" disabled={busy}>
                  Save society information
                </button>
              </form>
            )}
          </Load>
          {feedback && (
            <p className="ws-feedback" role="status">
              {feedback}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
