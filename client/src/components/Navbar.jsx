import { useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Menu,
  X,
  House,
  CalendarDays,
  Megaphone,
  LayoutDashboard,
  ClipboardList,
  MessagesSquare,
  UserRound,
  Shield,
  Boxes,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "./Workspace";
import "./Navbar.css";
const links = [
  ["/", "Home", House],
  ["/complaints", "Complaints", ClipboardList],
  ["/notices", "Announcements", Megaphone],
  ["/events", "Events", CalendarDays],
  ["/community", "Community", MessagesSquare],
  ["/settings", "My Profile", UserRound],
];
export default function Navbar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef(null);
  const [light, setLight] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.theme === "light",
  );
  function switchTheme() {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("society-theme", next);
    setLight(!light);
  }
  return (
    <aside
      className={"app-navigation" + (collapsed ? " collapsed" : "")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && mobileOpen) {
          setMobileOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <Link
        className="brand-logo-wrapper ws-brand"
        to="/"
        aria-label="SocietyCare Home"
      >
        <Brand />
        <strong>
          Society<span>Care</span>
        </strong>
      </Link>
      <div className="ws-nav-caption">
        {user.role === "ADMIN" ? "ADMIN WORKSPACE" : "RESIDENT WORKSPACE"}
      </div>
      <nav
        id="main-navigation"
        className={"nav-menu" + (mobileOpen ? " is-open" : "")}
        aria-label="Main navigation"
      >
        {[
          ...(user.role === "ADMIN" ? [["/dashboard", "Dashboard", LayoutDashboard]] : []),
          ...links,
          ...(user.role === "ADMIN"
            ? [["/assets", "Asset Management", Boxes], ["/admin", "Admin Management", Shield]]
            : []),
        ].map(([to, label, Icon]) => (
          <NavLink
            key={to}
            onClick={() => {
              if (mobileOpen) menuButton.current?.focus();
              setMobileOpen(false);
            }}
            to={to}
            end={to === "/"}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              "nav-link" + (isActive ? " active" : "")
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="ws-tools">
        <button
          ref={menuButton}
          className="mobile-menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button
          onClick={switchTheme}
          title="Switch theme"
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
        >
          {light ? <Moon size={17} /> : <Sun size={17} />}
          <span>{light ? "Dark" : "Light"} theme</span>
        </button>
        <button
          className="ws-collapse"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <PanelLeftClose size={17} />
        </button>
        <button
          onClick={logout}
          title="Sign out"
          aria-label="Log Out of SocietyCare"
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
