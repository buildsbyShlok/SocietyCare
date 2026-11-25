import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ClipboardCheck, Megaphone, MessagesSquare, QrCode } from "lucide-react";
import { Brand } from "./Workspace";

const INSIDE = [
  [ClipboardCheck, "Complaints you can follow from report to resolution"],
  [Megaphone, "Official announcements from your committee"],
  [MessagesSquare, "Events and a private chat for your society"],
  [QrCode, "Fault reporting straight from equipment labels"],
];

/** Shared two-panel frame for the sign-in and registration screens. */
export default function AuthShell({ title, subtitle, children, footer }) {
  const reduce = useReducedMotion();
  return (
    <div className="auth-page">
      <main className="auth-main">
        <Link to="/" className="auth-brand" aria-label="SocietyCare Home">
          <Brand size={30} />
          <strong>SocietyCare</strong>
        </Link>
        <motion.div
          className="auth-card"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="auth-header">
            <h1 className="auth-title">{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
          </header>
          {children}
          {footer && <p className="auth-footer">{footer}</p>}
        </motion.div>
      </main>
      <aside className="auth-aside" aria-label="About SocietyCare">
        <div className="auth-aside-inner">
          <p className="auth-aside-kicker">Inside your society workspace</p>
          <h2>Repairs, notices and neighbours, kept in one calm place.</h2>
          <ul>
            {INSIDE.map(([Icon, text]) => (
              <li key={text}>
                <Icon size={18} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
