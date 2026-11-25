import { Link } from "react-router-dom";
import { MapPin, Clock3 } from "lucide-react";
import { Load, Section, useResource } from "../components/Workspace";
import Courtyard from "../components/Courtyard";
import HomeAnnouncements from "../components/HomeAnnouncements";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (name || "").trim().split(/\s+/)[0];
  return first ? part + ", " + first : part;
}

export default function Home() {
  const info = useResource("/society"),
    events = useResource("/events?upcoming=true&limit=3");
  const { user } = useAuth();
  return (
    <div className="page ws-page home-page">
      <Load source={info}>
        {({ society: s }) => (
          <>
            <header className="home-heading">
              <div>
                <p className="ws-kicker">{greeting(user.name)}</p>
                <h1>{s?.name || "Your society"}</h1>
                <p>{s?.description || "Your society, in one place."}</p>
                {s?.address && (
                  <span className="home-address">
                    <MapPin size={14} aria-hidden="true" />
                    {s.address}
                  </span>
                )}
              </div>
              <div className="home-unit">
                <span>Your unit</span>
                <strong>
                  {[user.tower, user.flatNumber].filter(Boolean).join(" / ") ||
                    "Not recorded"}
                </strong>
              </div>
            </header>
            <div className="home-focus-grid">
              <section className="home-model-pane" aria-label="Society overview">
                <Courtyard />
              </section>
              <section className="home-announcement-pane" aria-labelledby="home-announcements-heading">
                <header>
                  <div>
                    <h2 id="home-announcements-heading">Announcements</h2>
                    <p>Official updates from society management</p>
                  </div>
                  <Link to="/notices">Notice board</Link>
                </header>
                <HomeAnnouncements />
              </section>
            </div>
          </>
        )}
      </Load>
      <Section
        title="Upcoming events"
        action={<Link to="/events">All events</Link>}
      >
        <Load source={events}>
          {({ items }) =>
            items.length ? (
              items.map((e) => {
                const d = new Date(e.startsAt);
                return (
                  <Link key={e.id} className="ws-row home-event" to={"/events/" + e.id}>
                    <span className="home-event-date" aria-hidden="true">
                      <small>{d.toLocaleString("en-IN", { month: "short" })}</small>
                      <b>{d.getDate()}</b>
                    </span>
                    <span className="home-event-text">
                      <strong>{e.title}</strong>
                      <small>
                        <Clock3 size={13} aria-hidden="true" />
                        {d.toLocaleString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {e.location && " · " + e.location}
                      </small>
                    </span>
                  </Link>
                );
              })
            ) : (
              <p>
                No upcoming events.{" "}
                <Link to="/events/new">Plan a gathering</Link>
              </p>
            )
          }
        </Load>
      </Section>
    </div>
  );
}
