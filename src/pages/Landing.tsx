/* ScholarAI — opening gate: choose Admin / Faculty / Student workspace. */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../state/auth";
import { overview } from "../lib/analytics";
import { mulberry32 } from "../lib/core";
import { INSTITUTION } from "../lib/institution";
import { IcBook, IcLogo, IcMortar, IcShield } from "../components/icons";

function useCountUp(target: number, delay = 0, dur = 950): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      if (t < t0) { raf = requestAnimationFrame(tick); return; }
      const k = Math.min(1, (t - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, dur]);
  return v;
}

function NetBackground() {
  const net = useMemo(() => {
    const r = mulberry32(7);
    const nodes = Array.from({ length: 18 }, (_, i) => ({ x: 30 + r() * 940, y: 20 + r() * 660, i }));
    const edges: [number, number][] = [];
    nodes.forEach((n, i) => {
      [...nodes]
        .map((m, j) => ({ j, d: (n.x - m.x) ** 2 + (n.y - m.y) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach((o) => edges.push([i, o.j]));
    });
    return { nodes, edges };
  }, []);
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {net.edges.map(([a, b], i) => (
        <line key={i} x1={net.nodes[a].x} y1={net.nodes[a].y} x2={net.nodes[b].x} y2={net.nodes[b].y}
          stroke="#a7b7c9" strokeOpacity="0.5" strokeWidth="1" className="flow-line" />
      ))}
      {net.nodes.map((n) => (
        <circle key={n.i} cx={n.x} cy={n.y} r={n.i % 6 === 0 ? 3.4 : 2.4}
          fill={n.i % 6 === 0 ? "#12998a" : n.i % 8 === 0 ? "#e29a17" : "#cbd6e1"} />
      ))}
    </svg>
  );
}

const GATES = [
  {
    role: "admin", icon: IcShield, accent: "#29405c", tint: "#29405c12",
    title: "Admin", desc: "Manage users, faculty, data collection, citations & reports",
    domain: INSTITUTION.adminFacultyDomain, example: "admin",
  },
  {
    role: "faculty", icon: IcMortar, accent: "#0e8172", tint: "#0e817214",
    title: "Faculty", desc: "Your publications, citations, H-index & collaboration analytics",
    domain: INSTITUTION.adminFacultyDomain, example: "shruti.thakur",
  },
  {
    role: "student", icon: IcBook, accent: "#3d6de0", tint: "#3d6de014",
    title: "Student", desc: "Read-only explorer for researchers, papers & networks",
    domain: INSTITUTION.studentDomain, example: "yash.gadhe.cse",
  },
];

export default function Landing() {
  const { user, booting } = useAuth();
  const nav = useNavigate();
  const ov = useMemo(() => overview(), []);
  const scholars = ov.platformTotals.find((p) => p.platform === "GOOGLE_SCHOLAR");
  const scopus = ov.platformTotals.find((p) => p.platform === "SCOPUS");
  const wos = ov.platformTotals.find((p) => p.platform === "WOS");

  const nRes = useCountUp(ov.totals.researchers, 100);
  const nScopus = useCountUp(scopus?.citations ?? 0, 250);
  const nScholar = useCountUp(scholars?.citations ?? 0, 400);
  const nWos = useCountUp(wos?.citations ?? 0, 550);

  if (booting) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <span className="text-ink-900 anim-fade-in"><IcLogo size={44} /></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-paper text-ink-900">
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#101e3114 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, #12998a1f, transparent)" }} />
      <div className="absolute -bottom-48 -right-32 w-[620px] h-[620px] rounded-full opacity-70" style={{ background: "radial-gradient(closest-side, #e29a171a, transparent)" }} />
      <div className="absolute inset-0 opacity-40"><NetBackground /></div>

      <div className="relative max-w-[1180px] mx-auto px-5 sm:px-8 flex flex-col min-h-screen">
        {/* top bar */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <span className="text-ink-900"><IcLogo size={34} /></span>
            <div>
              <div className="font-display font-semibold text-[19px] leading-none">Scholar<span className="text-primary-600">AI</span></div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-ink-400 mt-1">Research Intelligence</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="chip border border-ink-100 bg-surface text-ink-500">{INSTITUTION.name}</span>
            <span className="chip bg-gold-100 text-gold-700 border border-gold-300/60">Verified institutional import</span>
          </div>
        </header>

        {user && (
          <button onClick={() => nav(homeFor(user.role))}
            className="card p-4 mb-6 flex items-center gap-4 text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] transition-all anim-fade-up border-l-4 border-l-primary-600">
            <span className="w-10 h-10 rounded-lg bg-primary-700 text-white flex items-center justify-center font-bold text-sm">
              {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-ink-900">Signed in as {user.name}</span>
              <span className="block text-[12px] text-ink-500">{user.role} workspace · continue where you left off</span>
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0b6b5d" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        )}

        {/* main */}
        <main className="flex-1 grid lg:grid-cols-[1.12fr_1fr] gap-10 lg:gap-16 items-center py-8">
          <div>
            <div className="anim-fade-up flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-ink-500">
              <span className="w-8 h-px bg-primary-600" />
              {INSTITUTION.name} · {INSTITUTION.city}
            </div>
            <h1 className="anim-fade-up font-display font-semibold text-[40px] sm:text-[52px] leading-[1.06] mt-4 max-w-[560px]" style={{ animationDelay: "60ms" }}>
              One verified ledger of <em className="not-italic text-primary-700 underline decoration-gold-400 decoration-[5px] underline-offset-[7px]">institutional</em> research.
            </h1>
            <p className="anim-fade-up text-ink-500 text-[15px] leading-relaxed mt-5 max-w-[500px]" style={{ animationDelay: "120ms" }}>
              Faculty profiles harvested from ORCID, Scopus, Web of Science, Google Scholar and
              ResearchGate — validated, deduplicated by DOI, identity-resolved, and stored with
              full provenance. NA is never dressed up as zero.
            </p>

            <div className="anim-fade-up grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-[560px]" style={{ animationDelay: "180ms" }}>
              {[
                { label: "Researchers", value: nRes, color: "#29405c" },
                { label: "Scopus citations", value: nScopus, color: "#e9711c" },
                { label: "Scholar citations", value: nScholar, color: "#3d6de0" },
                { label: "WoS citations", value: nWos, color: "#1299b8" },
              ].map((s) => (
                <div key={s.label} className="card px-3.5 py-3 hover:-translate-y-0.5 transition-transform">
                  <div className="num text-[22px] font-semibold leading-none" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400 mt-1.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="anim-fade-up flex flex-wrap gap-x-6 gap-y-2 mt-7 text-[12px] text-ink-400" style={{ animationDelay: "240ms" }}>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary-500 dot-live" />Summary Check-First polling</span>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold-500" />Source metrics never blended</span>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-ink-400" />ORCID ↔ Scopus identity resolution</span>
            </div>
          </div>

          {/* workspace gates */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400 mb-3 anim-fade-up" style={{ animationDelay: "150ms" }}>
              Choose your workspace
            </div>
            <div className="space-y-3.5">
              {GATES.map((g, i) => {
                const Icon = g.icon;
                return (
                  <button key={g.role} onClick={() => nav(`/login?role=${g.role}`)}
                    className="anim-fade-up group w-full text-left card relative overflow-hidden p-5 flex items-center gap-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-pop)] cursor-pointer"
                    style={{ animationDelay: `${200 + i * 90}ms` }}>
                    <span className="absolute left-0 top-0 bottom-0 w-[5px] transition-all duration-200 group-hover:w-[8px]" style={{ background: g.accent }} />
                    <span className="w-13 h-13 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"
                      style={{ background: g.tint, color: g.accent, width: 52, height: 52 }}>
                      <Icon size={24} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2.5">
                        <span className="font-display font-semibold text-[21px] text-ink-900">{g.title}</span>
                        <span className="chip num border border-ink-100 bg-ink-50 text-ink-500 hidden sm:inline-flex">@{g.domain}</span>
                      </span>
                      <span className="block text-[12.5px] text-ink-500 mt-0.5 leading-snug">{g.desc}</span>
                      <span className="block num text-[11px] text-ink-400 mt-1">{g.example}@{g.domain}</span>
                    </span>
                    <svg className="shrink-0 transition-transform duration-200 group-hover:translate-x-1.5" width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke={g.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-ink-400 leading-relaxed mt-4 pl-1 anim-fade-up" style={{ animationDelay: "500ms" }}>
              Registration requires your institute email plus a valid <strong className="text-ink-600">ORCID</strong> and
              <strong className="text-ink-600"> Scopus ID</strong>. Faculty records stay NA-backed until an admin verifies them via <em>Validate & Fetch Data</em>.
            </p>
          </div>
        </main>

        <footer className="py-5 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-400">
          <span>ScholarAI · {INSTITUTION.shortName} research intelligence platform</span>
          <span className="num">NA = not collected · 0 = confirmed zero</span>
        </footer>
      </div>
    </div>
  );
}
