import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Navbar from "./Navbar";

/**
 * Layout — shared authenticated application shell for SocietyCare.
 *
 * Provides a responsive collapsible sidebar navigation and subtle
 * route transitions between operational views.
 */
export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      const main = document.getElementById("main-content");
      main?.scrollTo({ top: 0, behavior: "instant" });
      main?.focus({ preventScroll: true });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className={`app-layout${collapsed ? " sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar collapsed={collapsed} onToggle={toggleSidebar} />
      <main className="main-content" id="main-content" tabIndex={-1}>
        <motion.div
          key={location.pathname}
          className="route-frame"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense
            fallback={
              <div className="route-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                Loading…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </motion.div>
      </main>
    </div>
  );
}
