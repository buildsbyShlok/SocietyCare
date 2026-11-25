import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PageBoundary from "./components/PageBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ROLES } from "./utils/constants";

const ResidentDetails = lazy(() =>
  import("./components/ResidentRecord").then((m) => ({
    default: m.ResidentDetails,
  })),
);
const Events = lazy(() => import("./pages/Events"));
const Assets = lazy(() => import("./pages/Assets"));
const QRReport = lazy(() => import("./pages/QRReport"));
const AssetDetail = lazy(() => import("./pages/Assets").then(m => ({ default: m.AssetDetail })));
const AssetEditor = lazy(() => import("./pages/Assets").then(m => ({ default: m.AssetEditor })));
const EventDetail = lazy(() =>
  import("./pages/Events").then((m) => ({ default: m.EventDetail })),
);
const EventEditor = lazy(() =>
  import("./pages/Events").then((m) => ({ default: m.EventEditor })),
);
const Community = lazy(() => import("./pages/Community"));
const Admin = lazy(() => import("./pages/Admin"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Complaints = lazy(() => import("./pages/Complaints"));
const ComplaintDetail = lazy(() => import("./pages/ComplaintDetail"));
const CreateComplaint = lazy(() => import("./pages/CreateComplaint"));
const Notices = lazy(() => import("./pages/Notices"));
const NoticeDetail = lazy(() => import("./pages/NoticeDetail"));
const CreateNotice = lazy(() => import("./pages/CreateNotice"));
const Settings = lazy(() => import("./pages/Settings"));
const UserManagement = lazy(() => import("./pages/UserManagement"));

function DashboardDestination() {
  const { user } = useAuth();
  return user?.role === ROLES.RESIDENT ? <Navigate to="/complaints" replace /> : <Dashboard />;
}

export default function App() {
  const location = useLocation();
  return (
    <AuthProvider>
      <PageBoundary resetKey={location.pathname}>
        <Suspense
          fallback={
            <div className="loading-screen" role="status">
              <span className="spinner" aria-hidden="true" />
              Loading…
            </div>
          }
        >
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/report/:qrToken" element={<QRReport />} />
            {/* Keep Phase 1 printed labels working without changing their tokens. */}
            <Route path="/report/asset/:qrToken" element={<QRReport />} />

            {/* Authenticated routes — all roles */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/new" element={<EventEditor />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/events/:id/edit" element={<EventEditor />} />
              <Route path="/community" element={<Community />} />
              <Route path="/dashboard" element={<DashboardDestination />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/complaints/:id" element={<ComplaintDetail />} />
              <Route path="/notices" element={<Notices />} />
              <Route path="/notices/:id" element={<NoticeDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Authenticated routes — resident only */}
            <Route element={<ProtectedRoute requiredRole={ROLES.RESIDENT} />}>
              <Route path="/complaints/new" element={<CreateComplaint />} />
            </Route>

            {/* Authenticated routes — admin only */}
            <Route element={<ProtectedRoute requiredRole={ROLES.ADMIN} />}>
              <Route path="/assets" element={<Assets />} />
              <Route path="/assets/new" element={<AssetEditor />} />
              <Route path="/assets/:id" element={<AssetDetail />} />
              <Route path="/assets/:id/edit" element={<AssetEditor />} />
              <Route path="/notices/new" element={<CreateNotice />} />
              <Route path="/admin" element={<Admin />} />
              <Route
                path="/admin/residents/:id"
                element={<ResidentDetails />}
              />
              <Route path="/settings/users" element={<UserManagement />} />
            </Route>

            {/* Default redirect */}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </PageBoundary>
    </AuthProvider>
  );
}
