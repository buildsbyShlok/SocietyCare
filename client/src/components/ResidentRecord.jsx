import { Link, useParams } from "react-router-dom";
import { Load, Section, Row, money, useResource } from "./Workspace";
import { formatDate } from "../utils/helpers";
export function ResidentRecord({ id, details = false }) {
  const source = useResource("/users/" + encodeURIComponent(id) + "/record");
  return (
    <Load source={source}>
      {(u) => (
        <>
          {details && (
            <header className="resident-record-heading">
              <div className="resident-record-avatar">
                {u.avatarUrl ? (
                  <img
                    width="72"
                    height="72"
                    src={u.avatarUrl}
                    alt={u.name + "'s profile"}
                  />
                ) : (
                  <span aria-hidden="true">{u.name.slice(0, 1)}</span>
                )}
              </div>
              <div>
                <h2>{u.name}</h2>
                <p>{u.email}</p>
                <p>{u.phone || "Phone not provided"}</p>
              </div>
              <dl>
                <div>
                  <dt>Unit</dt>
                  <dd>{[u.tower, u.flatNumber].filter(Boolean).join(" / ")}</dd>
                </div>
                <div>
                  <dt>Account</dt>
                  <dd>{u.role === "ADMIN" ? "Administrator" : "Resident"}</dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>{formatDate(u.createdAt)}</dd>
                </div>
              </dl>
            </header>
          )}
          <Section title="Complaint history">
            {u.complaints.length ? (
              u.complaints.map((c) => (
                <Row
                  key={c.id}
                  to={"/complaints/" + c.id}
                  title={c.title}
                  detail={formatDate(c.createdAt)}
                  meta={
                    c.archivedAt ? "Archived" : c.status.replaceAll("_", " ")
                  }
                />
              ))
            ) : (
              <p>No complaints recorded.</p>
            )}
          </Section>
          <Section title="Maintenance payment history">
            {u.bills?.length ? (
              <div className="profile-payment-list">
                {u.bills.map((b) => (
                  <Link
                    key={b.id}
                    to={"/billing/" + b.id}
                    className="profile-payment"
                  >
                    <div>
                      <strong>{b.month}</strong>
                      <span>Verified {formatDate(b.payment.paidAt)}</span>
                    </div>
                    <div>
                      <span>Receipt {b.payment.id}</span>
                      <small>Reference {b.payment.reference}</small>
                    </div>
                    <strong>{money(b.amount)}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <p>No verified maintenance payments recorded.</p>
            )}
          </Section>
        </>
      )}
    </Load>
  );
}
export function ResidentDetails() {
  const { id } = useParams();
  return (
    <div className="page ws-page">
      <Link to="/settings/users">Back to resident directory</Link>
      <h1>Member record</h1>
      <ResidentRecord id={id} details />
    </div>
  );
}
