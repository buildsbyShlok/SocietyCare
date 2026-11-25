import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  Camera,
  CalendarDays,
  ClipboardCheck,
  Megaphone,
  MessagesSquare,
  Pin,
  QrCode,
  ShieldCheck,
  TimerReset,
  UserRoundCheck,
} from "lucide-react";
import Courtyard from "../components/Courtyard";
import { Brand } from "../components/Workspace";
import "./Welcome.css";

const EASE = [0.22, 1, 0.36, 1];

function Reveal({ as = "div", delay = 0, className, children, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.56, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* Illustrative sample only: shows how the real complaint screen reads at each stage. */
const STAGES = [
  {
    key: "OPEN",
    label: "Open",
    badge: "badge-open",
    title: "A resident reports it",
    text: "Title, description, category, priority and a photo of the problem. An optional writing assistant can tidy the description, and similar open complaints are flagged before it is sent.",
    events: [["Complaint raised by resident", "Photo attached · Priority high"]],
  },
  {
    key: "IN_PROGRESS",
    label: "In progress",
    badge: "badge-in-progress",
    title: "The committee takes it on",
    text: "Admins set status and priority and leave remarks the resident can read. Anything left open too long is marked overdue automatically, so nothing quietly stalls.",
    events: [
      ["Complaint raised by resident", "Photo attached · Priority high"],
      ["Status changed to In progress", "Remark: technician booked for Thursday"],
    ],
  },
  {
    key: "RESOLVED",
    label: "Resolved",
    badge: "badge-resolved",
    title: "It is closed, with a record",
    text: "The resident sees the outcome and the full history. Status changes can also be sent by email when your society has notifications set up.",
    events: [
      ["Complaint raised by resident", "Photo attached · Priority high"],
      ["Status changed to In progress", "Remark: technician booked for Thursday"],
      ["Status changed to Resolved", "Remark: door sensor replaced"],
    ],
  },
];

function RequestJourney() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  useEffect(() => {
    if (reduce || paused || !inView) return undefined;
    const id = setTimeout(() => setActive((n) => (n + 1) % STAGES.length), 4200);
    return () => clearTimeout(id);
  }, [active, paused, inView, reduce]);
  const stage = STAGES[active];
  return (
    <div
      className="journey"
      ref={ref}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
    >
      <div className="journey-steps" role="tablist" aria-label="Complaint stages">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            id={"stage-tab-" + s.key}
            aria-selected={i === active}
            aria-controls="stage-panel"
            className={"journey-step" + (i === active ? " is-active" : "") + (i < active ? " is-done" : "")}
            onClick={() => setActive(i)}
          >
            <span className="journey-marker" aria-hidden="true" />
            <span className="journey-step-text">
              <span className={"badge " + s.badge}>{s.label}</span>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </span>
          </button>
        ))}
      </div>
      <div
        className="journey-preview"
        id="stage-panel"
        role="tabpanel"
        aria-labelledby={"stage-tab-" + stage.key}
      >
        <div className="preview-window" aria-hidden="true">
          <div className="preview-bar">
            <span />
            <span />
            <span />
            <em>Complaint detail · sample</em>
          </div>
          <div className="preview-body">
            <div className="preview-head">
              <div>
                <small>Electrical · Tower B</small>
                <h4>Lift stops between floors 6 and 7</h4>
              </div>
              <motion.span
                key={stage.key}
                className={"badge " + stage.badge}
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {stage.label}
              </motion.span>
            </div>
            <p className="preview-desc">
              Since this morning the lift halts between the 6th and 7th floor
              and the doors take a few seconds to open.
            </p>
            <ol className="preview-history">
              {stage.events.map(([title, meta], i) => (
                <motion.li
                  key={title}
                  initial={reduce || i < stage.events.length - 1 ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.36, ease: EASE, delay: 0.08 }}
                >
                  <strong>{title}</strong>
                  <span>{meta}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
        <div className="journey-progress" aria-hidden="true">
          {STAGES.map((s, i) => (
            <span key={s.key} className={i <= active ? "is-on" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SampleQR() {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString("SocietyCare sample equipment label", {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#17191c", light: "#00000000" },
    })
      .then((s) => live && setSvg(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return <span className="qr-graphic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const RESIDENT = [
  [Camera, "Raise a complaint with a photo", "Pick a category and priority, attach a picture, and follow every status change and remark."],
  [Megaphone, "Read official announcements", "Pinned and categorised notices from the committee, each with its own page."],
  [CalendarDays, "Plan and join events", "Anyone can publish a gathering with a time, place and poster."],
  [MessagesSquare, "Talk with neighbours", "A private society chat with replies, images and unit labels."],
];
const COMMITTEE = [
  [ClipboardCheck, "Triage in one queue", "Filter by status, priority and source; update with remarks; archive with a reason."],
  [TimerReset, "Catch what is overdue", "Open complaints past their window are flagged automatically on the dashboard."],
  [UserRoundCheck, "Verify who joins", "Registrations arrive as requests. You approve each resident before they can sign in."],
  [ShieldCheck, "Moderate fairly", "Reported chat messages come to you for review and removal."],
];

export default function Welcome() {
  const reduce = useReducedMotion();
  const hero = (i) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: EASE, delay: 0.06 + i * 0.07 },
        };
  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-nav">
        <div className="landing-wrap landing-nav-inner">
          <Link className="landing-brand" to="/" aria-label="SocietyCare Home">
            <Brand size={30} />
            <strong>SocietyCare</strong>
          </Link>
          <nav aria-label="Page sections" className="landing-anchors">
            <a href="#how">How it works</a>
            <a href="#roles">Residents & committee</a>
            <a href="#equipment">Equipment QR</a>
          </nav>
          <div className="landing-nav-actions">
            <Link className="btn btn-ghost" to="/login">
              Sign in
            </Link>
            <Link className="btn btn-primary" to="/register">
              Request access
            </Link>
          </div>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-wrap hero-grid">
            <div className="hero-copy">
              <motion.p className="landing-overline" {...hero(0)}>
                For residential societies and their committees
              </motion.p>
              <motion.h1 {...hero(1)}>
                The quiet way to run a residential society.
              </motion.h1>
              <motion.p className="hero-lede" {...hero(2)}>
                Residents report repairs and follow them to the end. The committee
                sees every request, notice and neighbour in one place. Nothing
                gets lost in a group chat.
              </motion.p>
              <motion.div className="hero-actions" {...hero(3)}>
                <Link className="btn btn-primary btn-hero" to="/login">
                  Sign in to your society
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="btn btn-secondary btn-hero" to="/register">
                  Register as a resident
                </Link>
              </motion.div>
              <motion.p className="hero-note" {...hero(4)}>
                <ShieldCheck size={15} aria-hidden="true" />
                New residents are verified by their society administrator before
                they can sign in.
              </motion.p>
            </div>
            <motion.div
              className="hero-scene"
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            >
              <Courtyard />
              <span className="hero-scene-hint">Drag to look around</span>
            </motion.div>
          </div>
        </section>

        <section className="landing-section" id="how" aria-labelledby="how-title">
          <div className="landing-wrap">
            <Reveal className="section-head">
              <p className="landing-overline">How a request moves</p>
              <h2 id="how-title">From “the lift is acting up” to a closed record.</h2>
              <p>
                Every complaint follows the same visible path, so residents
                always know where things stand and the committee never has to
                chase updates by phone.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <RequestJourney />
            </Reveal>
          </div>
        </section>

        <section className="landing-section landing-roles" id="roles" aria-labelledby="roles-title">
          <div className="landing-wrap">
            <Reveal className="section-head section-head-split">
              <h2 id="roles-title">One workspace, two sides of the building.</h2>
              <p>
                Residents and administrators sign in to the same society, but
                each sees the tools that fit their role.
              </p>
            </Reveal>
            <div className="roles-grid">
              {[
                ["For residents", "role-residents", RESIDENT],
                ["For the managing committee", "role-committee", COMMITTEE],
              ].map(([title, cls, items], col) => (
                <Reveal key={title} className={"role-column " + cls} delay={col * 0.08}>
                  <h3>{title}</h3>
                  <ul>
                    {items.map(([Icon, name, text]) => (
                      <li key={name}>
                        <Icon size={18} aria-hidden="true" />
                        <div>
                          <strong>{name}</strong>
                          <span>{text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-equipment" id="equipment" aria-labelledby="equipment-title">
          <div className="landing-wrap equipment-grid">
            <Reveal className="equipment-copy">
              <p className="landing-overline">
                <QrCode size={15} aria-hidden="true" /> Equipment QR reporting
              </p>
              <h2 id="equipment-title">Every lift, pump and generator gets a label.</h2>
              <p>
                Register shared equipment, print its QR label and stick it on.
                Whoever scans it reports a fault that is already linked to that
                asset, so each machine builds its own complaint history.
              </p>
              <ul className="equipment-points">
                <li>Labels carry a private token, not the asset’s internal ID</li>
                <li>Deactivate an asset to pause reporting from its label</li>
                <li>See the most-reported equipment on the dashboard</li>
              </ul>
            </Reveal>
            <Reveal className="equipment-visual" delay={0.1}>
              <figure className="qr-label" aria-label="Sample equipment label">
                <div className="qr-label-top">
                  <Brand size={22} />
                  <span>SocietyCare</span>
                </div>
                <SampleQR />
                <figcaption>
                  <strong>Passenger lift · Tower B</strong>
                  <span className="mono">LIFT-B-01</span>
                  <em>Scan to report a fault</em>
                </figcaption>
              </figure>
              <p className="qr-caption">Sample label. The code encodes placeholder text only.</p>
            </Reveal>
          </div>
        </section>

        <section className="landing-section landing-life" aria-labelledby="life-title">
          <div className="landing-wrap life-grid">
            <Reveal className="section-head">
              <p className="landing-overline">Beyond repairs</p>
              <h2 id="life-title">The noticeboard, the calendar and the chat, together.</h2>
              <p>
                Society information lives next to the work: announcements with
                categories and pins, events anyone can publish, and a private
                community conversation the committee can moderate.
              </p>
            </Reveal>
            <Reveal className="life-board" delay={0.08} aria-hidden="true">
              <div className="life-notice is-pinned">
                <span className="life-tag">
                  <Pin size={13} /> Pinned · Maintenance
                </span>
                <strong>Water tank cleaning on Sunday</strong>
                <span>Supply paused 10:00 to 14:00 in all towers.</span>
              </div>
              <div className="life-row">
                <div className="life-date">
                  <small>Dec</small>
                  <strong>14</strong>
                </div>
                <div>
                  <strong>Winter potluck in the courtyard</strong>
                  <span>Society hall lawn · 7:00 pm</span>
                </div>
              </div>
              <div className="life-chat">
                <p className="bubble">
                  <small>B-304</small>
                  Does anyone have a ladder I could borrow this evening?
                </p>
                <p className="bubble is-own">
                  <small>You</small>
                  Yes, drop by C-502 after six.
                </p>
              </div>
              <p className="life-sample">Sample content</p>
            </Reveal>
          </div>
        </section>

        <section className="landing-close" aria-labelledby="close-title">
          <Reveal className="landing-wrap close-inner">
            <h2 id="close-title">Your society is waiting inside.</h2>
            <p>
              Sign in with the account your administrator approved, or send a
              request to join your society.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-hero" to="/login">
                Sign in
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="btn btn-secondary btn-hero" to="/register">
                Request resident access
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap footer-inner">
          <span className="landing-brand">
            <Brand size={22} />
            <strong>SocietyCare</strong>
          </span>
          <span>Maintenance, notices, events and community for residential societies.</span>
          <nav aria-label="Account">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
