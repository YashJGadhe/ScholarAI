import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, homeFor, useAuth } from "./state/auth";
import type { Role } from "./lib/core";
import { ToastProvider } from "./components/ui";
import { IcLogo } from "./components/icons";
import Shell from "./layouts/Shell";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import UsersPage from "./pages/admin/Users";
import FacultyPage from "./pages/admin/Faculty";
import AddFaculty from "./pages/admin/AddFaculty";
import CitationsPage from "./pages/admin/Citations";
import PollingPage from "./pages/admin/Polling";
import AdminAnalytics from "./pages/admin/Analytics";
import ReportsPage from "./pages/admin/Reports";
import SettingsPage from "./pages/admin/Settings";
import { FacultyAnalytics, FacultyHome, FacultyProfile, FacultyPublications } from "./pages/faculty/Portal";
import { StudentAnalytics, StudentHome, StudentPublications, StudentResearchers } from "./pages/student/Portal";

const TITLES: [string, string][] = [
  ["/admin/faculty/add", "Add Faculty"],
  ["/admin/faculty", "Faculty"],
  ["/admin/users", "Users"],
  ["/admin/citations", "Citation Management"],
  ["/admin/polling", "On-Demand Polling"],
  ["/admin/analytics", "Analytics"],
  ["/admin/reports", "Reports & Export"],
  ["/admin/settings", "System & APIs"],
  ["/admin", "Dashboard"],
  ["/faculty/profile", "Profile & Identity"],
  ["/faculty/publications", "Publications"],
  ["/faculty/analytics", "Analytics"],
  ["/faculty", "My Dashboard"],
  ["/student/researchers", "Researchers"],
  ["/student/publications", "Publication Explorer"],
  ["/student/analytics", "Analytics & Collaboration"],
  ["/student", "Overview"],
];

function BootSplash() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 anim-fade-in">
        <span className="text-ink-900"><IcLogo size={44} /></span>
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-ink-400">ScholarAI</div>
      </div>
    </div>
  );
}

function Guard({ children, roles }: { children: ReactNode; roles: Role[] }) {
  const { user, booting } = useAuth();
  if (booting) return <BootSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function ProtectedShell({ children, roles }: { children: ReactNode; roles: Role[] }) {
  const loc = useLocation();
  const title = TITLES.find(([p]) => loc.pathname === p)?.[1] ?? "ScholarAI";
  return (
    <Guard roles={roles}>
      <Shell title={title}>{children}</Shell>
    </Guard>
  );
}

function RootRedirect() {
  const { user, booting } = useAuth();
  if (booting) return <BootSplash />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

function LoginRoute() {
  const { user, booting } = useAuth();
  if (booting) return <BootSplash />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginRoute />} />

            <Route path="/admin" element={<ProtectedShell roles={["ADMIN"]}><AdminDashboard /></ProtectedShell>} />
            <Route path="/admin/users" element={<ProtectedShell roles={["ADMIN"]}><UsersPage /></ProtectedShell>} />
            <Route path="/admin/faculty" element={<ProtectedShell roles={["ADMIN"]}><FacultyPage /></ProtectedShell>} />
            <Route path="/admin/faculty/add" element={<ProtectedShell roles={["ADMIN"]}><AddFaculty /></ProtectedShell>} />
            <Route path="/admin/citations" element={<ProtectedShell roles={["ADMIN"]}><CitationsPage /></ProtectedShell>} />
            <Route path="/admin/polling" element={<ProtectedShell roles={["ADMIN"]}><PollingPage /></ProtectedShell>} />
            <Route path="/admin/analytics" element={<ProtectedShell roles={["ADMIN"]}><AdminAnalytics /></ProtectedShell>} />
            <Route path="/admin/reports" element={<ProtectedShell roles={["ADMIN"]}><ReportsPage /></ProtectedShell>} />
            <Route path="/admin/settings" element={<ProtectedShell roles={["ADMIN"]}><SettingsPage /></ProtectedShell>} />

            <Route path="/faculty" element={<ProtectedShell roles={["FACULTY", "ADMIN"]}><FacultyHome /></ProtectedShell>} />
            <Route path="/faculty/profile" element={<ProtectedShell roles={["FACULTY", "ADMIN"]}><FacultyProfile /></ProtectedShell>} />
            <Route path="/faculty/publications" element={<ProtectedShell roles={["FACULTY", "ADMIN"]}><FacultyPublications /></ProtectedShell>} />
            <Route path="/faculty/analytics" element={<ProtectedShell roles={["FACULTY", "ADMIN"]}><FacultyAnalytics /></ProtectedShell>} />

            <Route path="/student" element={<ProtectedShell roles={["STUDENT", "FACULTY", "ADMIN"]}><StudentHome /></ProtectedShell>} />
            <Route path="/student/researchers" element={<ProtectedShell roles={["STUDENT", "FACULTY", "ADMIN"]}><StudentResearchers /></ProtectedShell>} />
            <Route path="/student/publications" element={<ProtectedShell roles={["STUDENT", "FACULTY", "ADMIN"]}><StudentPublications /></ProtectedShell>} />
            <Route path="/student/analytics" element={<ProtectedShell roles={["STUDENT", "FACULTY", "ADMIN"]}><StudentAnalytics /></ProtectedShell>} />

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
