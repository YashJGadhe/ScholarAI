import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../state/auth";
import { ApiError } from "../lib/api";
import { Spinner, useToast } from "../components/ui";
import { IcAlert, IcCheck, IcLogo } from "../components/icons";

const PIPELINE = ["Validate", "Normalize", "Deduplicate", "Identity", "MongoDB", "Analytics"];

function PipelineArt() {
  return (
    <svg viewBox="0 0 560 300" className="w-full max-w-[560px]">
      {/* source nodes */}
      {[
        { label: "ORCID", c: "#7ba23f", y: 40 },
        { label: "Scopus", c: "#e9711c", y: 100 },
        { label: "Web of Science", c: "#1299b8", y: 160 },
        { label: "Google Scholar", c: "#3d6de0", y: 220 },
        { label: "ResearchGate", c: "#00a89b", y: 272 },
      ].map((n) => (
        <g key={n.label}>
          <rect x="10" y={n.y - 14} width="132" height="28" rx="7" fill="#ffffff" opacity="0.07" />
          <rect x="10" y={n.y - 14} width="132" height="28" rx="7" fill="none" stroke={n.c} strokeOpacity="0.55" />
          <circle cx="26" cy={n.y} r="4" fill={n.c} />
          <text x="38" y={n.y + 4} fontSize="12" fontWeight="600" fill="#e3eaf1" fontFamily="Public Sans">{n.label}</text>
          <path d={`M142 ${n.y} C 200 ${n.y}, 210 150, 258 150`} stroke={n.c} strokeOpacity="0.7" strokeWidth="1.3" fill="none" className="flow-line" />
        </g>
      ))}
      {/* pipeline boxes */}
      {PIPELINE.map((p, i) => {
        const x = 258 + i * 50;
        return (
          <g key={p}>
            {i > 0 && <path d={`M${x - 50 + 40} 150 h 10`} stroke="#56708e" strokeWidth="1.2" className="flow-line" fill="none" />}
            <rect x={x} y={p === "MongoDB" ? 130 : 136} width={p === "MongoDB" ? 40 : 40} height={p === "MongoDB" ? 40 : 28} rx="7"
              fill={p === "MongoDB" ? "#0e8172" : "#101e31"} stroke={p === "MongoDB" ? "#12998a" : "#33496b"} />
            {p === "MongoDB" ? (
              <g stroke="#fff" strokeWidth="1.4" fill="none">
                <ellipse cx={x + 20} cy={141} rx="11" ry="4" />
                <path d={`M${x + 9} 141 v 18 c0 2.2 4.9 4 11 4 s11-1.8 11-4 v-18`} />
              </g>
            ) : (
              <text x={x + 20} y={154} fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#a7b7c9" fontFamily="Public Sans">
                {p === "Validate" ? "VALID" : p === "Normalize" ? "NORM" : p === "Deduplicate" ? "DEDUP" : p === "Identity" ? "ID" : "AI"}
              </text>
            )}
            <text x={x + 20} y={p === "MongoDB" ? 186 : 180} fontSize="9.5" fontWeight="600" textAnchor="middle" fill="#7a90a9" fontFamily="Public Sans">{p}</text>
          </g>
        );
      })}
      <path d="M498 150 C 520 150, 520 90, 548 90" stroke="#f2b33d" strokeWidth="1.3" fill="none" className="flow-line" />
      <path d="M498 150 C 520 150, 520 210, 548 210" stroke="#12998a" strokeWidth="1.3" fill="none" className="flow-line" />
      <text x="548" y="84" fontSize="10.5" fontWeight="700" fill="#f2b33d" textAnchor="end" fontFamily="Public Sans">Dashboards</text>
      <text x="548" y="228" fontSize="10.5" fontWeight="700" fill="#45a695" textAnchor="end" fontFamily="Public Sans">Reports & AI insights</text>
    </svg>
  );
}

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@scholarai.edu", pw: "Admin@123", desc: "Full system access" },
  { label: "Faculty", email: "anitha@scholarai.edu", pw: "Faculty@123", desc: "Dr. Anitha Raman" },
  { label: "Student", email: "student@scholarai.edu", pw: "Student@123", desc: "Read-only access" },
];

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match.");
      setShake((s) => s + 1);
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login" ? await login(email, password) : await register(name, email, password);
      toast("success", mode === "login" ? `Welcome back, ${user.name.split(" ")[0]}.` : "Account created — signed in as Student.");
      nav(homeFor(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-paper">
      {/* left: system panel */}
      <div className="hidden lg:flex flex-col w-[46%] bg-ink-950 text-ink-100 p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(#e3eaf1 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="text-white"><IcLogo size={38} /></span>
            <div>
              <div className="font-display font-semibold text-2xl text-white">Scholar<span className="text-primary-400">AI</span></div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-ink-400 mt-0.5">Academic Research Intelligence</div>
            </div>
          </div>
          <h1 className="font-display text-[34px] leading-[1.15] font-semibold text-white mt-10 max-w-md">
            Five research platforms. <span className="text-primary-300">One verified</span> institutional record.
          </h1>
          <p className="text-ink-300 text-sm leading-relaxed mt-4 max-w-md">
            ScholarAI harvests researcher and publication data from ORCID, Scopus, Web of Science,
            Google Scholar and ResearchGate — then validates, normalizes, deduplicates and resolves
            identities before a single record reaches MongoDB.
          </p>
          <div className="mt-8"><PipelineArt /></div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-[12px] text-ink-400">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary-400 dot-live" />Summary Check-First polling</span>
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold-400" />NA-aware metrics — never a false zero</span>
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#3d6de0]" />ORCID ↔ Scopus identity resolution</span>
          </div>
        </div>
      </div>

      {/* right: auth card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <span className="text-ink-900"><IcLogo size={32} /></span>
            <div className="font-display font-semibold text-xl text-ink-900">Scholar<span className="text-primary-600">AI</span></div>
          </div>
          <div className="card p-7 anim-fade-up">
            <div className="flex rounded-lg bg-ink-50 p-1 mb-6">
              {(["login", "register"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 h-9 rounded-md text-sm font-semibold transition-colors cursor-pointer ${mode === m ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
                  {m === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>
            <h2 className="font-display text-[22px] font-semibold text-ink-900">{mode === "login" ? "Welcome back" : "Create an account"}</h2>
            <p className="text-sm text-ink-500 mt-1 mb-5">
              {mode === "login" ? "Sign in to your research workspace." : "New accounts join as Student (read-only). Admins can promote roles."}
            </p>
            {error && (
              <div key={shake} className="anim-shake flex items-start gap-2 bg-danger-50 border border-danger-100 text-danger-700 rounded-lg px-3 py-2.5 text-[13px] font-medium mb-4">
                <span className="mt-0.5"><IcAlert size={15} /></span>{error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-3.5">
              {mode === "register" && (
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sundaram" required />
                </div>
              )}
              <div>
                <label className="label">Institutional email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@scholarai.edu" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
              </div>
              {mode === "register" && (
                <div>
                  <label className="label">Confirm password</label>
                  <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
                </div>
              )}
              <button type="submit" className="btn-primary w-full mt-2" disabled={busy}>
                {busy ? <Spinner light /> : null} {mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>

          <div className="card p-4 mt-4 anim-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400 mb-2.5">Demo accounts</div>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((d) => (
                <button key={d.label} onClick={() => { setMode("login"); setEmail(d.email); setPassword(d.pw); setError(null); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-ink-100 hover:border-primary-300 hover:bg-primary-50/50 transition-colors cursor-pointer text-left group">
                  <span className="w-2 h-2 rounded-full bg-primary-500 group-hover:scale-125 transition-transform" />
                  <span className="text-sm font-semibold text-ink-800 w-16">{d.label}</span>
                  <span className="num text-[11.5px] text-ink-500">{d.email}</span>
                  <span className="ml-auto text-[11px] text-ink-400">{d.desc}</span>
                  <IcCheck size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
