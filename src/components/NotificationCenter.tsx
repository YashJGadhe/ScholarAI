/* ScholarAI — notification bell + dropdown panel */

import { useEffect, useRef, useState } from "react";
import { fetchNotifications, fetchUnreadCount, markAllAsRead, markAsRead, type Notification } from "../lib/notifications";
import { IcAlert, IcBook, IcCheck, IcExternal, IcInfo, IcSpark } from "./icons";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function priorityColor(priority: string): string {
  switch (priority) {
    case "CRITICAL": return "#cc3d3d";
    case "HIGH": return "#e9711c";
    case "MEDIUM": return "#e29a17";
    default: return "#7a90a9";
  }
}

function eventIcon(eventType: string) {
  if (eventType.includes("PUBLICATION") || eventType.includes("INDEXED")) return <IcBook size={15} />;
  if (eventType.includes("ERROR") || eventType.includes("WARNING") || eventType.includes("ALERT")) return <IcAlert size={15} />;
  return <IcSpark size={15} />;
}

function platformLabel(platform: string | null): string {
  if (!platform) return "";
  return {
    SCOPUS: "Scopus",
    WOS: "Web of Science",
    GOOGLE_SCHOLAR: "Google Scholar",
    ORCID: "ORCID",
    RESEARCHGATE: "ResearchGate",
  }[platform] || platform;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [notifs, count] = await Promise.all([fetchNotifications(20), fetchUnreadCount()]);
      setNotifications(notifs);
      setUnread(count);
    } catch {
      /* ignore — will retry on next poll */
    } finally {
      setLoading(false);
    }
  };

  // Initial load + periodic refresh (simulates real-time; replace with WebSocket/SSE later)
  useEffect(() => {
    load();
    const iv = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(iv);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, is_read: true } : n));
    setUnread((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-ink-500 hover:bg-ink-50 hover:text-ink-700 transition-colors cursor-pointer"
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-h-[520px] card overflow-hidden flex flex-col z-50 anim-fade-up" style={{ boxShadow: "var(--shadow-pop)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-ink-50/50">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-ink-900 text-[15px]">Notifications</h3>
              {unread > 0 && (
                <span className="chip bg-primary-50 text-primary-700 border border-primary-200 h-5 text-[10px]">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} className="text-[11.5px] font-bold text-primary-700 hover:text-primary-800 cursor-pointer">
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 mx-auto rounded-xl bg-ink-50 text-ink-300 flex items-center justify-center mb-2">
                  <IcCheck size={20} />
                </div>
                <p className="text-sm text-ink-400">All caught up</p>
                <p className="text-[11.5px] text-ink-300 mt-0.5">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100/70">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`px-4 py-3 hover:bg-primary-50/30 transition-colors ${!n.is_read ? "bg-primary-50/20" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${priorityColor(n.priority)}18`, color: priorityColor(n.priority) }}
                      >
                        {eventIcon(n.event_type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[13px] text-ink-900 truncate">{n.title}</span>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-[12px] text-ink-500 leading-relaxed line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-ink-400">
                          {n.platform && (
                            <span className="chip h-4 px-1.5 bg-ink-50 border border-ink-100 text-ink-500 text-[9.5px]">
                              {platformLabel(n.platform)}
                            </span>
                          )}
                          <span>{timeAgo(n.created_at)}</span>
                        </div>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkRead(n._id)}
                          className="shrink-0 p-1 rounded text-ink-300 hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
                          title="Mark as read"
                        >
                          <IcCheck size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
