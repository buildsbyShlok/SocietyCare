import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  Clock3,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Load, useResource } from "../components/Workspace";
import { request } from "../api";
const when = (d) =>
  new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
export default function Events() {
  const [page, setPage] = useState(1),
    [upcoming, setUpcoming] = useState(true);
  const source = useResource("/events?page=" + page + "&upcoming=" + upcoming);
  return (
    <div className="page ws-page">
      <header className="page-header">
        <div className="page-header-title">
          <h1>Events</h1>
          <p className="page-header-subtitle">
            Gatherings, celebrations and things to look forward to. Anyone in
            the society can publish one.
          </p>
        </div>
        <Link className="btn btn-primary" to="/events/new">
          Create event
        </Link>
      </header>
      <div className="segmented" role="group" aria-label="Which events to show">
        <button
          className="segmented-btn"
          aria-pressed={upcoming}
          onClick={() => {
            setUpcoming(true);
            setPage(1);
          }}
        >
          Upcoming
        </button>
        <button
          className="segmented-btn"
          aria-pressed={!upcoming}
          onClick={() => {
            setUpcoming(false);
            setPage(1);
          }}
        >
          All events
        </button>
      </div>
      <Load source={source}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="event-list">
                {data.items.map((e) => (
                  <Link
                    to={"/events/" + e.id}
                    className="event-item"
                    key={e.id}
                  >
                    {e.imageUrl ? (
                      <img
                        src={e.imageUrl}
                        alt={e.title + " poster"}
                        loading="lazy"
                      />
                    ) : (
                      <div className="event-date">
                        <span>
                          {new Date(e.startsAt).toLocaleString([], {
                            month: "short",
                          })}
                        </span>
                        <strong>{new Date(e.startsAt).getDate()}</strong>
                      </div>
                    )}
                    <div>
                      <h2>{e.title}</h2>
                      <p>
                        <CalendarDays size={15} /> {when(e.startsAt)}
                      </p>
                      <p>
                        <MapPin size={15} /> {e.location}
                      </p>
                      <small>Hosted by {e.creator?.name || "Deleted account"}</small>
                    </div>
                    <ArrowUpRight size={20} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <CalendarDays size={28} aria-hidden="true" />
                <h3>No {upcoming ? "upcoming " : ""}events yet</h3>
                <p>Create one to bring your neighbours together.</p>
                <Link className="btn btn-primary btn-sm" to="/events/new">
                  Create event
                </Link>
              </div>
            )}
            {(page > 1 || data.hasNext) && (
              <nav className="event-pagination" aria-label="Event pages">
                <button
                  className="btn btn-secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  className="btn btn-secondary"
                  disabled={!data.hasNext}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </Load>
    </div>
  );
}
export function EventDetail() {
  const { id } = useParams(),
    { user, token } = useAuth(),
    navigate = useNavigate();
  const source = useResource("/events/" + encodeURIComponent(id)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm("Remove this event from the society calendar?")) return;
    setBusy(true);
    try {
      await request("DELETE", "/events/" + id, null, token);
      navigate("/events");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page ws-page">
      <Link className="back-link" to="/events">All events</Link>
      <Load source={source}>
        {(e) => (
          <article className="event-reading">
            {e.imageUrl && (
              <img
                className="event-poster"
                src={e.imageUrl}
                alt={e.title + " poster"}
              />
            )}
            <header className="event-detail-heading">
              <div className="event-date">
                <span>
                  {new Date(e.startsAt).toLocaleString([], { month: "short" })}
                </span>
                <strong>{new Date(e.startsAt).getDate()}</strong>
              </div>
              <div>
                <span className="ws-kicker">Society event</span>
                <h1>{e.title}</h1>
              </div>
            </header>
            <div className="event-detail-layout">
              <section className="event-description">
                <h2>About this gathering</h2>
                <div className="reading-body">{e.description}</div>
              </section>
              <aside className="event-facts">
                <div>
                  <CalendarDays size={19} />
                  <span>
                    <small>Date</small>
                    {new Date(e.startsAt).toLocaleDateString([], {
                      dateStyle: "full",
                    })}
                  </span>
                </div>
                <div>
                  <Clock3 size={19} />
                  <span>
                    <small>Time · local timezone</small>
                    {new Date(e.startsAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                </div>
                <div>
                  <MapPin size={19} />
                  <span>
                    <small>Location</small>
                    {e.location}
                  </span>
                </div>
                <div>
                  <UserRound size={19} />
                  <span>
                    <small>Hosted by</small>
                    {e.creator?.name || "Deleted account"}
                    <small>
                      {[e.creator?.tower, e.creator?.flatNumber]
                        .filter(Boolean)
                        .join(" / ")}
                    </small>
                  </span>
                </div>
              </aside>
            </div>
            {(e.creatorId === user.id || user.role === "ADMIN") && (
              <div className="ws-inline">
                <Link
                  className="btn btn-secondary"
                  to={"/events/" + id + "/edit"}
                >
                  Edit event
                </Link>
                <button
                  className="btn btn-danger"
                  onClick={remove}
                  disabled={busy}
                >
                  Remove event
                </button>
              </div>
            )}
            {error && <p role="alert">{error}</p>}
          </article>
        )}
      </Load>
    </div>
  );
}
export function EventEditor() {
  const { id } = useParams();
  const source = useResource(id ? "/events/" + encodeURIComponent(id) : null);
  return (
    <div className="page ws-page">
      <Link className="back-link" to={id ? "/events/" + id : "/events"}>{id ? "Back to event" : "All events"}</Link>
      <h1>{id ? "Edit event" : "Create an event"}</h1>
      {id ? (
        <Load source={source}>{(e) => <EventForm key={e.id} event={e} />}</Load>
      ) : (
        <EventForm />
      )}
    </div>
  );
}
function EventForm({ event }) {
  const { user, token } = useAuth(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const date = event && new Date(event.startsAt),
    local = date
      ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  if (event && event.creatorId !== user.id && user.role !== "ADMIN")
    return (
      <p role="alert">Only the creator or an admin can edit this event.</p>
    );
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const file = data.get("image");
    if (!file?.size) data.delete("image");
    if (file?.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    const start = new Date(data.get("startsAt"));
    if (isNaN(start)) {
      setError("Select a date and time.");
      return;
    }
    data.set("startsAt", start.toISOString());
    setBusy(true);
    setError("");
    try {
      const result = await request(
        event ? "PATCH" : "POST",
        "/events" + (event ? "/" + event.id : ""),
        data,
        token,
      );
      navigate("/events/" + result.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ws-form" onSubmit={save}>
      <label>
        Event title
        <input
          name="title"
          required
          maxLength={150}
          defaultValue={event?.title}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          required
          maxLength={5000}
          rows={7}
          defaultValue={event?.description}
        />
      </label>
      <label>
        Date and time (your local time)
        <input
          type="datetime-local"
          name="startsAt"
          required
          defaultValue={local}
        />
      </label>
      <label>
        Location
        <input
          name="location"
          required
          maxLength={240}
          defaultValue={event?.location}
        />
      </label>
      <label>
        Poster or image · JPEG, PNG or WebP, up to 5 MB
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      {event?.imageUrl && (
        <label className="ws-inline">
          <input name="removeImage" value="true" type="checkbox" /> Remove
          current poster
        </label>
      )}
      <p>Published events are visible to everyone in the society.</p>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : event ? "Save changes" : "Publish event"}
      </button>
    </form>
  );
}
