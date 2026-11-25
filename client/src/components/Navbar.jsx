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
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "./Workspace";
import "./Navbar.css";

const SOCIETY = [
  ["/", "Home", House],
  ["/notices", "Announcements", Megaphone],
  ["/events", "Events", CalendarDays],
  ["/community", "Community", MessagesSquare],
];

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "SC"
  );
}

export default function Navbar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef(null);
  const [light, setLight] = useState(
    () =>
      typeof document === "undefined" ||
      document.documentElement.dataset.theme !== "dark",
  );
  const isAdmin = user.role === "ADMIN";
  function switchTheme() {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("society-theme", next);
    setLight(!light);
  }
  const groups = [
    ["Society", SOCIETY],
    [
      isAdmin ? "Operations" : "Requests",
      [
        ...(isAdmin ? [["/dashboard", "Dashboard", LayoutDashboard]] : []),
        ["/complaints", "Complaints", ClipboardList],
        ...(isAdmin
          ? [
              ["/assets", "Asset Management", Boxes],
              ["/admin", "Admin Management", Shield],
            ]
          : []),
      ],
    ],
    ["Account", [["/settings", "My Profile", UserRound]]],
  ];
  const unit = [user.tower, user.flatNumber].filter(Boolean).join(" / ");
  return (
    <aside
      className={
        "app-navigation" +
        (collapsed ? " collapsed" : "") +
        (mobileOpen ? " menu-open" : "")
      }
      onKeyDown={(e) => {
        if (e.key === "Escape" && mobileOpen) {
          setMobileOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="nav-head">
        <Link
          className="brand-logo-wrapper ws-brand"
          to="/"
          aria-label="SocietyCare Home"
        >
          <Brand size={30} />
          <strong>SocietyCare</strong>
        </Link>
        <button
          ref={menuButton}
          className="mobile-menu-toggle nav-icon-btn"
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <nav
        id="main-navigation"
        className={"nav-menu" + (mobileOpen ? " is-open" : "")}
        aria-label="Main navigation"
      >
        {groups.map(([caption, items]) => (
          <div className="nav-group" key={caption}>
            <span className="nav-group-label" aria-hidden="true">
              {caption}
            </span>
            {items.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                onClick={() => {
                  if (mobileOpen) menuButton.current?.focus();
                  setMobileOpen(false);
                }}
                to={to}
                end={to === "/"}
                title={collapsed ? label : undefined}
                aria-label={label}
                className={({ isActive }) =>
                  "nav-link" + (isActive ? " active" : "")
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="ws-tools">
        <div className="nav-identity">
          <span className="nav-avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="nav-identity-text">
            <strong>{user.name || (isAdmin ? "Administrator" : "Resident")}</strong>
            <small>
              {isAdmin ? "Admin" : "Resident"}
              {unit && " · " + unit}
            </small>
          </span>
        </div>
        <div className="nav-tool-row">
          <button
            className="nav-icon-btn"
            onClick={switchTheme}
            title={light ? "Switch to dark theme" : "Switch to light theme"}
            aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          >
            {light ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button
            className="ws-collapse nav-icon-btn"
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button
            className="nav-icon-btn nav-signout"
            onClick={logout}
            title="Sign out"
            aria-label="Log Out of SocietyCare"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
