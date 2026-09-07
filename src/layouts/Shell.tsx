import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { getDB } from "../lib/db";
import { initials } from "../lib/core";
import {
  IcChart, IcDashboard, IcGear, IcLogo, IcLogout, IcMortar, IcPlus, IcQuote,
  IcRadar, IcReport, IcUsers, IcBook, IcNetwork, IcEye, IcAlert,
} from "../components/icons";
import NotificationCenter from "../components/NotificationCenter";

interface NavItem { to: string; label: string; icon: (p: { size?: number }) => ReactNode; end?: boolean }

const NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { to: "/admin", label: "Dashboard", icon: (p) => <IcDashboard {...p} />, end: true },
    { to: "/admin/faculty", label: "Faculty", icon: (p) => <IcMortar {...p} /> },
    { to: "/admin/faculty/add", label: "Add Faculty", icon: (p) => <IcPlus {...p} /> },
    { to: "/admin/users", label: "Users", icon: (p) => <IcUsers {...p} /> },
    { to: "/admin/citations", label: "Citations", icon: (p) => <IcQuote {...p} /> },
    { to: "/admin/research-papers", label: "Research Papers", icon: (p) => <IcBook {...p} /> },
    { to: "/admin/polling", label: "Polling", icon: (p) => <IcRadar {...p} /> },
    { to: "/admin/analytics", label: "Analytics", icon: (p) => <IcChart {...p} /> },
    { to: "/admin/reports", label: "Reports", icon: (p) => <IcReport {...p} /> },
    { to: "/admin/settings", label: "System / APIs", icon: (p) => <IcGear {...p} /> },
  ],
  FACULTY: [
    { to: "/faculty", label: "My Dashboard", icon: (p) => <IcDashboard {...p} />, end: true },
    { to: "/faculty/profile", label: "Profile & Identity", icon: (p) => <IcEye {...p} /> },
    { to: "/faculty/publications", label: "Publications", icon: (p) => <IcBook {...p} /> },
    { to: "/faculty/research-papers", label: "Research Papers", icon: (p) => <IcBook {...p} /> },
    { to: "/faculty/analytics", label: "Analytics", icon: (p) => <IcChart {...p} /> },
    { to: "/faculty/notifications", label: "Notifications", icon: (p) => <IcAlert {...p} /> },
  ],
  STUDENT: [
    { to: "/student", label: "Overview", icon: (p) => <IcDashboard {...p} />, end: true },
    { to: "/student/researchers", label: "Researchers", icon: (p) => <IcMortar {...p} /> },
    { to: "/student/publications", label: "Publications", icon: (p) => <IcBook {...p} /> },
    { to: "/student/analytics", label: "Analytics", icon: (p) => <IcNetwork {...p} /> },
  ],
};

function ConnectorStrip() {
  const db = getDB();
  const s = db.settings;
  const items = [
    { label: "ORCID", ok: !!s.keys.orcid },
    { label: "Scopus", ok: !!s.keys.scopus },
    { label: "WoS", ok: !!s.keys.wos },
    { label: "Scholar", ok: !!s.keys.serpapi },
    { label: "RG", ok: s.researchgate_mode !== "OFF", warn: s.researchgate_mode === "MANUAL_IMPORT" },
  ];
  return (
    <div className="hidden lg:flex items-center gap-1.5" title="Connector status">
      {items.map((it) => (
        <span key={it.label} className={`chip border ${it.ok ? "bg-primary-50 border-primary-200 text-primary-800" : "bg-ink-50 border-ink-100 text-ink-400"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${it.ok ? (it.warn ? "bg-gold-500" : "bg-primary-500 dot-live") : "bg-ink-300"}`} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export default function Shell({ children, title }: { children: ReactNode; title: string }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => (user ? NAV[user.role] ?? [] : []), [user]);

  const doLogout = () => { logout(); nav("/login"); };

  return (
    <div className="min-h-screen bg-paper flex">
      {open && <div className="fixed inset-0 bg-ink-950/40 z-40 lg:hidden" onClick={() => setOpen(false)} />}
      {/* sidebar */}
      <aside className={`fixed lg:sticky top-0 h-screen w-[232px] shrink-0 z-50 bg-ink-950 text-ink-100 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/8">
          <span className="text-white"><IcLogo size={30} /></span>
          <div>
            <div className="font-display font-semibold text-[17px] text-white leading-none">Scholar<span className="text-primary-400">AI</span></div>
            <div className="text-[10px] tracking-[0.16em] uppercase text-ink-400 mt-1">Research Intelligence</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 px-3 mb-2">{user?.role} workspace</div>
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 h-10 rounded-lg mb-0.5 text-[13.5px] font-semibold transition-colors ${
                  isActive ? "bg-primary-700/90 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : "text-ink-300 hover:text-white hover:bg-white/6"}`}>
              {it.icon({ size: 17 })}
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/8">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-9 h-9 rounded-lg bg-primary-700 text-white flex items-center justify-center font-bold text-xs">{user ? initials(user.name) : "?"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-ink-400 truncate">{user?.email}</div>
            </div>
            <button onClick={doLogout} title="Sign out" className="p-2 rounded-md text-ink-400 hover:text-white hover:bg-white/10 cursor-pointer"><IcLogout size={16} /></button>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-surface/90 backdrop-blur border-b border-ink-100 flex items-center gap-3 px-4 sm:px-6">
          <button className="lg:hidden p-2 -ml-2 rounded-md text-ink-500 hover:bg-ink-50 cursor-pointer" onClick={() => setOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <h2 className="font-display font-semibold text-ink-900 text-[17px]">{title}</h2>
          <div className="ml-auto flex items-center gap-3">
            <ConnectorStrip />
            <NotificationCenter />
            <span className="chip bg-gold-100 text-gold-700 border border-gold-300/60" title="Sandbox build: seeded demo corpus, simulated connector responses. External APIs require live credentials.">
              Demo dataset
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-[1320px] w-full mx-auto">{children}</main>
        <footer className="px-6 py-4 text-[11px] text-ink-400 border-t border-ink-100 flex flex-wrap gap-2 justify-between">
          <span>ScholarAI · Academic Research Intelligence Platform</span>
          <span>Summary Check-First polling · NA = not collected, 0 = confirmed zero</span>
        </footer>
      </div>
    </div>
  );
}
