import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Load, Row, Section, useResource } from "../components/Workspace";
import Courtyard from "../components/Courtyard";
import HomeAnnouncements from "../components/HomeAnnouncements";
import { useAuth } from "../context/AuthContext";
import "./Home.css";
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
                <h1>{s?.name || "Your society"}</h1>
                <p>{s?.description || "Your society, in one place."}</p>
                {s?.address && (
                  <span className="home-address">
                    <MapPin size={14} />
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
              items.map((e) => (
                <Row
                  key={e.id}
                  to={"/events/" + e.id}
                  title={e.title}
                  detail={new Date(e.startsAt).toLocaleString()}
                  meta={e.location}
                />
              ))
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
