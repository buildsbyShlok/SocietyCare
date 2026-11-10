import Metric from "../components/Metric";
import { ClipboardList, CircleDot, Clock3, CircleCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useResource, Load, Row, Section } from "../components/Workspace";
import { STATUS_LABELS } from "../utils/constants";
export default function Dashboard() {
  const stats = useResource("/dashboard"),
    recent = useResource("/complaints?limit=5"),
    notices = useResource("/notices?limit=5&sort=latest");
  const { user } = useAuth();
  return (
    <div className="page ws-page">
      <h1>
        {user.role === "ADMIN" ? "Operations dashboard" : "Your dashboard"}
      </h1>
      <p className="ws-muted">
        {user.role === "ADMIN"
          ? "Activity across the society"
          : "Activity for your account"}
      </p>
      <Load source={stats}>
        {(s) => (
          <>
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
            {user.role === "ADMIN" && (
              <small>
                {s.overdueCount} overdue complaints · {s.byStatus.IN_PROGRESS}{" "}
                in progress
              </small>
            )}
          </>
        )}
      </Load>
      <div className="ws-columns">
        <Section
          title="Recent complaints"
          action={<Link to="/complaints">View all ↗</Link>}
        >
          <Load source={recent}>
            {({ items }) =>
              items.length ? (
                items.map((c) => (
                  <Row
                    key={c.id}
                    to={"/complaints/" + c.id}
                    title={c.title}
                    meta={STATUS_LABELS[c.status]}
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
          action={<Link to="/notices">Noticeboard ↗</Link>}
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
