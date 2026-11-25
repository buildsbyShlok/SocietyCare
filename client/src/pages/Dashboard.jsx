import Metric from "../components/Metric";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CircleDot,
  Clock3,
  CircleCheck,
  Box,
  PauseCircle,
  QrCode,
  Megaphone,
} from "lucide-react";
import "../components/AssetComplaints.css";
import { formatDate } from "../utils/helpers";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useResource, Load, Row, Section } from "../components/Workspace";
import { STATUS_LABELS } from "../utils/constants";

const today = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export default function Dashboard() {
  const stats = useResource("/dashboard"),
    recent = useResource("/complaints?limit=5"),
    notices = useResource("/notices?limit=5&sort=latest");
  const { user } = useAuth();
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="page ws-page dashboard-page">
      <header className="page-intro">
        <div>
          <p className="ws-kicker">{today()}</p>
          <h1>{isAdmin ? "Operations dashboard" : "Your dashboard"}</h1>
          <p>
            {isAdmin
              ? "Activity across the society"
              : "Activity for your account"}
          </p>
        </div>
        {isAdmin && (
          <div className="ws-inline">
            <Link className="btn btn-secondary" to="/notices/new">
              <Megaphone size={16} aria-hidden="true" />
              New announcement
            </Link>
            <Link className="btn btn-primary" to="/complaints">
              Open complaint queue
            </Link>
          </div>
        )}
      </header>
      <Load source={stats}>
        {(s) => (
          <>
            {isAdmin && s.overdueCount > 0 && (
              <Link className="dash-attention" to="/complaints">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>
                    {s.overdueCount} overdue{" "}
                    {s.overdueCount === 1 ? "complaint" : "complaints"}
                  </strong>{" "}
                  · {s.byStatus.IN_PROGRESS} in progress
                </span>
                <span className="dash-attention-cta">
                  Review queue
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </Link>
            )}
            {isAdmin && s.overdueCount === 0 && (
              <p className="dash-calm">
                <CircleCheck size={16} aria-hidden="true" />
                No overdue complaints · {s.byStatus.IN_PROGRESS} in progress
              </p>
            )}
            <div className="metric-grid">
              <Metric
                label="Total complaints"
                value={s.totalComplaints}
                icon={ClipboardList}
                note="Active and resolved records"
              />
              {[
                ["Open", s.byStatus.OPEN, CircleDot, "open"],
                ["In progress", s.byStatus.IN_PROGRESS, Clock3, "progress"],
                ["Resolved", s.byStatus.RESOLVED, CircleCheck, "success"],
              ].map(([label, value, icon, tone]) => (
                <Metric
                  key={label}
                  label={label}
                  value={value}
                  icon={icon}
                  tone={tone}
                  ratio={
                    s.totalComplaints ? (value / s.totalComplaints) * 100 : 0
                  }
                  note={
                    s.totalComplaints
                      ? Math.round((value / s.totalComplaints) * 100) +
                        "% of complaints"
                      : "No complaints yet"
                  }
                />
              ))}
            </div>
            {isAdmin && s.assets && (
              <section
                className="asset-statistics dash-block"
                aria-labelledby="asset-statistics-heading"
              >
                <header className="dash-block-head">
                  <h2 id="asset-statistics-heading">Equipment & reporting</h2>
                  <p className="ws-muted">
                    Complaint counts exclude archived and removed records. Open
                    means awaiting work.
                  </p>
                </header>
                <div className="metric-grid">
                  <Metric label="Active assets" value={s.assets.active} icon={Box} note="Equipment in service" />
                  <Metric label="Inactive assets" value={s.assets.inactive} icon={PauseCircle} note="Reporting unavailable" />
                  <Metric label="QR complaints" value={s.assets.qrComplaints} icon={QrCode} note="Submitted from equipment labels" />
                  <Metric label="Open asset complaints" value={s.assets.openComplaints} icon={CircleDot} tone="open" note="Linked reports awaiting work" />
                </div>
                <Section
                  title="Most reported equipment"
                  action={<Link to="/assets">Asset Management</Link>}
                >
                  {s.assets.mostReported.length ? (
                    s.assets.mostReported.map((asset) => (
                      <Row
                        key={asset.id}
                        to={"/assets/" + asset.id}
                        title={asset.name}
                        detail={asset.assetCode}
                        meta={
                          asset.complaintCount +
                          (asset.complaintCount === 1 ? " complaint" : " complaints")
                        }
                      />
                    ))
                  ) : (
                    <p className="ws-muted">No asset-related complaints yet.</p>
                  )}
                </Section>
              </section>
            )}
          </>
        )}
      </Load>
      <div className="ws-columns">
        <Section
          title="Recent complaints"
          action={<Link to="/complaints">View all</Link>}
        >
          <Load source={recent}>
            {({ items }) =>
              items.length ? (
                items.map((c) => (
                  <Row
                    key={c.id}
                    to={"/complaints/" + c.id}
                    title={c.title}
                    detail={
                      isAdmin
                        ? [
                            c.resident?.name || "Deleted resident",
                            formatDate(c.createdAt),
                            c.source === "QR" ? "QR" : "Manual",
                            c.asset
                              ? c.asset.name + " · " + c.asset.assetCode
                              : "Not linked to an asset",
                          ].join(" · ")
                        : undefined
                    }
                    meta={
                      <span className={"status-dot status-" + c.status}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    }
                  />
                ))
              ) : (
                <p>No complaints yet.</p>
              )
            }
          </Load>
        </Section>
        <Section
          title="Announcements"
          action={<Link to="/notices">Noticeboard</Link>}
        >
          <Load source={notices}>
            {({ items }) =>
              items.length ? (
                items.map((n) => (
                  <Row
                    key={n.id}
                    to={"/notices/" + n.id}
                    title={n.title}
                    detail={n.content}
                  />
                ))
              ) : (
                <p>No announcements yet.</p>
              )
            }
          </Load>
        </Section>
      </div>
    </div>
  );
}
