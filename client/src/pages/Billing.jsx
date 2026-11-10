import { Link, useParams } from "react-router-dom";
import { ReceiptText, CircleCheck, Wallet } from "lucide-react";
import Metric from "../components/Metric";
import { useState } from "react";
import { request } from "../api";
import { useAuth } from "../context/AuthContext";
import { Load, Section, money, useResource } from "../components/Workspace";
import { formatDate } from "../utils/helpers";

function IssueForm({ submit, busy }) {
  const members = useResource("/users");
  return (
    <Section title="Issue a monthly invoice">
      <Load source={members}>
        {({ data }) => (
          <form
            className="ws-form"
            onSubmit={(e) => submit(e, "/billing", "Invoice issued.")}
          >
            <label>
              Responsible resident
              <select name="residentId" required defaultValue="">
                <option value="" disabled>
                  Choose a resident and unit
                </option>
                {data
                  .filter((u) => u.role === "RESIDENT" && !u.disabled)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {[u.tower, u.flatNumber, u.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  ))}
              </select>
            </label>
            <div className="ws-inline">
              <label>
                Billing month
                <input type="month" required name="month" />
              </label>
              <label>
                Amount (₹)
                <input
                  name="amount"
                  type="number"
                  min=".01"
                  max="9999999999.99"
                  step=".01"
                  required
                />
              </label>
              <label>
                Due date
                <input name="dueDate" required type="date" />
              </label>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              Generate invoice
            </button>
          </form>
        )}
      </Load>
    </Section>
  );
}

function useBillingActions() {
  const { user, token } = useAuth();
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const source = useResource("/billing", revision);
  async function submit(e, path, success) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setFeedback("");
    try {
      await request("POST", path, values, token);
      form.reset();
      setFeedback(success);
      setRevision((n) => n + 1);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  }
  return { source, busy, feedback, submit, admin: user.role === "ADMIN" };
}
const sum = (items) =>
  items.reduce((s, b) => s + Math.round(Number(b.amount) * 100), 0) / 100;
const unit = (b) =>
  [b.tower, b.flatNumber].filter(Boolean).join(" / ") || "Not recorded";
export function BillingStatus({ status }) {
  return (
    <span className={"invoice-status invoice-status-" + status.toLowerCase()}>
      <i aria-hidden="true" />
      {status === "PAID"
        ? "Paid"
        : status === "OVERDUE"
          ? "Overdue"
          : "Awaiting payment"}
    </span>
  );
}
export default function Billing() {
  const { source, busy, feedback, submit, admin } = useBillingActions();
  const [filter, setFilter] = useState("ALL"),
    [month, setMonth] = useState(() => {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    });
  return (
    <div className="page ws-page billing-page">
      <h1>Maintenance &amp; Billing</h1>
      <p className="ws-muted">
        {admin
          ? "Society invoices and verified payments."
          : "Your unit invoices and verified payments."}
      </p>
      {feedback && (
        <p className="ws-feedback" role="status">
          {feedback}
        </p>
      )}
      <Load source={source}>
        {({ items }) => {
          const monthly = items.filter((b) => b.month === month),
            outstanding = items.filter((b) => !b.payment);
          const shown = items.filter(
            (b) => filter === "ALL" || b.status === filter,
          );
          return (
            <>
              <div className="billing-period">
                <label htmlFor="billing-month">Monthly overview</label>
                <input
                  id="billing-month"
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <div className="metric-grid metric-grid-three">
                <Metric
                  label="Monthly dues"
                  value={money(sum(monthly))}
                  icon={ReceiptText}
                  note={
                    monthly.length +
                    " invoices · " +
                    (month || "select a month")
                  }
                />
                <Metric
                  label="Paid toward this month"
                  value={money(sum(monthly.filter((b) => b.payment)))}
                  icon={CircleCheck}
                  tone="success"
                  note="Verified payments against selected invoices"
                />
                <Metric
                  label="Total outstanding"
                  value={money(sum(outstanding))}
                  icon={Wallet}
                  tone={outstanding.length ? "open" : "neutral"}
                  note={outstanding.length + " unpaid invoices · all months"}
                />
              </div>
              <Section
                title="Invoice register"
                action={
                  <select
                    className="form-select invoice-filter"
                    aria-label="Filter invoices"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["ALL", "PENDING", "OVERDUE", "PAID"].map((s) => (
                      <option key={s} value={s}>
                        {s === "ALL"
                          ? "All invoices"
                          : s === "PENDING"
                            ? "Awaiting payment"
                            : s === "PAID"
                              ? "Paid"
                              : "Overdue"}
                      </option>
                    ))}
                  </select>
                }
              >
                <div className="invoice-register">
                  <div className="invoice-columns" aria-hidden="true">
                    <span>Invoice / flat</span>
                    <span>Billing period</span>
                    <span>Due date</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                  {shown.map((b) => (
                    <Link
                      to={"/billing/" + b.id}
                      key={b.id}
                      className="invoice-row"
                    >
                      <div className="invoice-identity">
                        <span className="invoice-id">#{b.id}</span>
                        <strong>Flat {unit(b)}</strong>
                        <small>{b.resident?.name || "Deleted account"}</small>
                      </div>
                      <div>
                        <small className="invoice-mobile-label">
                          Billing period
                        </small>
                        {b.month}
                      </div>
                      <div>
                        <small className="invoice-mobile-label">Due date</small>
                        {formatDate(b.dueDate)}
                      </div>
                      <strong className="invoice-amount">
                        {money(b.amount)}
                      </strong>
                      <BillingStatus status={b.status} />
                    </Link>
                  ))}
                  {!shown.length && (
                    <p className="invoice-empty">
                      No invoices match this view.
                    </p>
                  )}
                </div>
              </Section>
            </>
          );
        }}
      </Load>
      {admin && <IssueForm submit={submit} busy={busy} />}
    </div>
  );
}
export function InvoiceDetail() {
  const { id } = useParams(),
    { source, busy, feedback, submit, admin } = useBillingActions();
  return (
    <div className="page ws-page">
      <Link to="/billing">Back to Maintenance &amp; Billing</Link>
      <Load source={source}>
        {({ items }) => {
          const b = items.find((item) => item.id === id);
          if (!b)
            return (
              <section className="invoice-document">
                <h1>Invoice not found</h1>
                <p>
                  This invoice is unavailable or does not belong to your
                  account.
                </p>
              </section>
            );
          return (
            <article className="invoice-document">
              <header className="invoice-document-heading">
                <div>
                  <span className="ws-kicker">MAINTENANCE INVOICE</span>
                  <h1>{b.month}</h1>
                  <span className="invoice-id">#{b.id}</span>
                </div>
                <BillingStatus status={b.status} />
              </header>
              <dl className="invoice-parties">
                <div>
                  <dt>Billed to</dt>
                  <dd>
                    {b.resident?.name || "Deleted account"}
                    <small>Flat {unit(b)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>{formatDate(b.createdAt)}</dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>{formatDate(b.dueDate)}</dd>
                </div>
              </dl>
              <section
                className="invoice-breakdown"
                aria-label="Payment breakdown"
              >
                <div className="invoice-line heading">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="invoice-line">
                  <span>
                    Society maintenance <small>Billing period {b.month}</small>
                  </span>
                  <strong>{money(b.amount)}</strong>
                </div>
                <div className="invoice-totals">
                  <div>
                    <span>Invoice total</span>
                    <strong>{money(b.amount)}</strong>
                  </div>
                  <div>
                    <span>Verified paid amount</span>
                    <strong>{money(b.payment ? b.amount : 0)}</strong>
                  </div>
                  <div className="invoice-balance">
                    <span>Balance due</span>
                    <strong>{money(b.payment ? 0 : b.amount)}</strong>
                  </div>
                </div>
              </section>
              {b.payment ? (
                <section className="invoice-receipt">
                  <h2>
                    <CircleCheck size={20} /> Payment receipt
                  </h2>
                  <dl>
                    <div>
                      <dt>Receipt number</dt>
                      <dd>{b.payment.id}</dd>
                    </div>
                    <div>
                      <dt>Payment reference</dt>
                      <dd>{b.payment.reference}</dd>
                    </div>
                    <div>
                      <dt>Verified on</dt>
                      <dd>{formatDate(b.payment.paidAt)}</dd>
                    </div>
                    <div>
                      <dt>Amount received</dt>
                      <dd>{money(b.amount)}</dd>
                    </div>
                  </dl>
                </section>
              ) : (
                <section className="invoice-payment">
                  <h2>Payment verification</h2>
                  <p>
                    {admin
                      ? "Record the reference after confirming the full payment."
                      : "No verified payment has been recorded. Contact society management with your payment reference."}
                  </p>
                  {admin && (
                    <form
                      className="ws-inline"
                      onSubmit={(e) =>
                        submit(
                          e,
                          "/billing/" + b.id + "/payment",
                          "Payment verified and receipt recorded.",
                        )
                      }
                    >
                      <label>
                        External payment reference
                        <input name="reference" required maxLength={100} />
                      </label>
                      <button className="btn btn-primary" disabled={busy}>
                        {busy ? "Verifying…" : "Verify full payment"}
                      </button>
                    </form>
                  )}
                </section>
              )}
              {feedback && (
                <p role="status" className="ws-feedback">
                  {feedback}
                </p>
              )}
            </article>
          );
        }}
      </Load>
    </div>
  );
}
