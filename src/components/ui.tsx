import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { IdentityStatus, Platform } from "../lib/core";
import { PLATFORM_COLOR, PLATFORM_LABEL, fmtMetric } from "../lib/core";
import { IcAlert, IcCheck, IcInfo, IcX } from "./icons";

/* ---------------- toasts ---------------- */

interface Toast { id: number; kind: "success" | "error" | "info"; text: string }
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className={`anim-fade-up card flex items-start gap-2.5 px-4 py-3 text-sm font-medium border-l-4 ${
            t.kind === "success" ? "border-l-primary-500" : t.kind === "error" ? "border-l-danger-600" : "border-l-ink-400"}`}>
            <span className={t.kind === "success" ? "text-primary-600 mt-0.5" : t.kind === "error" ? "text-danger-600 mt-0.5" : "text-ink-400 mt-0.5"}>
              {t.kind === "success" ? <IcCheck /> : t.kind === "error" ? <IcAlert /> : <IcInfo />}
            </span>
            <span className="text-ink-800">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- modal / confirm ---------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 sm:p-8 anim-fade-in" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} anim-fade-up my-auto`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-700 cursor-pointer"><IcX /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, body, danger, busy }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; danger?: boolean; busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-ink-600 leading-relaxed">{body}</div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy ? <Spinner light /> : null} Confirm
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- primitives ---------------- */

export function Spinner({ light }: { light?: boolean }) {
  return <span className={`spin inline-block w-4 h-4 rounded-full border-2 ${light ? "border-white/40 border-t-white" : "border-ink-200 border-t-primary-600"}`} />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-xl bg-ink-50 text-ink-400 flex items-center justify-center mb-3">{icon ?? <IcInfo size={22} />}</div>
      <div className="font-display font-semibold text-ink-800 text-lg">{title}</div>
      {body && <p className="text-sm text-ink-500 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function StatCard({ label, value, suffix, sub, tone = "ink", delay = 0 }: {
  label: string; value: number; suffix?: string; sub?: ReactNode; tone?: "ink" | "teal" | "amber" | "blue"; delay?: number;
}) {
  const v = useCountUp(value);
  const tones = { ink: "text-ink-900", teal: "text-primary-700", amber: "text-gold-600", blue: "text-[#3d6de0]" };
  return (
    <div className="card p-5 anim-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</div>
      <div className={`num text-[32px] leading-tight font-semibold mt-1.5 ${tones[tone]}`}>
        {v.toLocaleString("en-US")}{suffix && <span className="text-lg text-ink-400 ml-1">{suffix}</span>}
      </div>
      {sub && <div className="text-xs text-ink-500 mt-1.5 flex items-center gap-1.5">{sub}</div>}
    </div>
  );
}

/* ---------------- domain chips ---------------- */

export function IdentityBadge({ status, size = "md" }: { status: IdentityStatus; size?: "sm" | "md" }) {
  const map = {
    VERIFIED: "bg-primary-50 text-primary-700 border border-primary-200",
    PARTIALLY_VERIFIED: "bg-warn-50 text-warn-700 border border-gold-300",
    NOT_VERIFIED: "bg-danger-50 text-danger-700 border border-danger-100",
  };
  const label = { VERIFIED: "Verified", PARTIALLY_VERIFIED: "Partially verified", NOT_VERIFIED: "Not verified" }[status];
  return (
    <span className={`chip ${map[status]} ${size === "sm" ? "h-5 text-[10px]" : ""}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "VERIFIED" ? "bg-primary-500" : status === "PARTIALLY_VERIFIED" ? "bg-gold-500" : "bg-danger-600"}`} />
      {label}
    </span>
  );
}

export function PlatformChip({ platform }: { platform: Platform }) {
  const c = PLATFORM_COLOR[platform];
  return (
    <span className="chip bg-ink-50 text-ink-700 border border-ink-100">
      <span className="w-2 h-2 rounded-[3px]" style={{ background: c }} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN: "bg-ink-900 text-white",
    FACULTY: "bg-primary-100 text-primary-800",
    STUDENT: "bg-[#e7edfb] text-[#2f55b8]",
  };
  return <span className={`chip ${map[role] ?? "bg-ink-50 text-ink-600"}`}>{role}</span>;
}

/** NA-aware metric cell — null renders "NA" (unknown), 0 renders 0 (confirmed). */
export function Metric({ v, strong }: { v: number | null | undefined; strong?: boolean }) {
  const isNA = v === null || v === undefined;
  return (
    <span className={`num ${isNA ? "text-ink-300 italic" : strong ? "text-ink-900 font-semibold" : "text-ink-700"}`}>
      {fmtMetric(v)}
    </span>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold text-ink-900 leading-tight">{title}</h1>
        {sub && <p className="text-sm text-ink-500 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
