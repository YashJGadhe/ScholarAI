/* ScholarAI — hand-drawn inline SVG icon set (stroke-based, 24px grid). */

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: P, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const IcLogo = ({ size = 26, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden {...rest}>
    <rect width="32" height="32" rx="7" fill="currentColor" opacity="0.12" />
    <circle cx="11" cy="11" r="3" fill="#12998a" />
    <circle cx="22" cy="13" r="2.4" fill="#e9711c" />
    <circle cx="15" cy="22" r="2.4" fill="#f2b33d" />
    <path d="M11 11L22 13L15 22Z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const IcDashboard = (p: P) => base(p, <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><path d="M13.5 17h7M17 13.5v7" /></>);
export const IcUsers = (p: P) => base(p, <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.4a3.2 3.2 0 010 5.9M17.5 14.8c1.7.7 2.7 2.3 3 4.7" /></>);
export const IcMortar = (p: P) => base(p, <><path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.2c0 1.2 2.5 2.6 5.5 2.6s5.5-1.4 5.5-2.6V11" /><path d="M21.5 9v5" /></>);
export const IcQuote = (p: P) => base(p, <><path d="M5 13.5c0-4 2-6.7 5-8l.8 1.6c-1.8 1-2.8 2.4-3 3.9.4-.2.8-.3 1.3-.3 1.7 0 2.9 1.2 2.9 3s-1.4 3.3-3.3 3.3c-2.2 0-3.7-1.5-3.7-3.5z" /><path d="M13.5 13.5c0-4 2-6.7 5-8l.8 1.6c-1.8 1-2.8 2.4-3 3.9.4-.2.8-.3 1.3-.3 1.7 0 2.9 1.2 2.9 3s-1.4 3.3-3.3 3.3c-2.2 0-3.7-1.5-3.7-3.5z" /></>);
export const IcRadar = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12L18 6" /><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" /></>);
export const IcChart = (p: P) => base(p, <><path d="M4 4v16h16" /><path d="M8 16v-5M12 16V7M16 16v-8" /></>);
export const IcReport = (p: P) => base(p, <><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4" /><path d="M9 12h6M9 15.5h6" /></>);
export const IcGear = (p: P) => base(p, <><circle cx="12" cy="12" r="3" /><path d="M12 2.8l1.2 2.4 2.6.5 1.9-1.9 1.5 1.5-1.9 1.9.5 2.6 2.4 1.2-2.4 1.2-.5 2.6 1.9 1.9-1.5 1.5-1.9-1.9-2.6.5L12 21.2l-1.2-2.4-2.6-.5-1.9 1.9-1.5-1.5 1.9-1.9-.5-2.6L3.8 12l2.4-1.2.5-2.6-1.9-1.9 1.5-1.5 1.9 1.9 2.6-.5z" /></>);
export const IcLogout = (p: P) => base(p, <><path d="M14 4H6v16h8" /><path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" /></>);
export const IcPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IcSearch = (p: P) => base(p, <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>);
export const IcCheck = (p: P) => base(p, <path d="M4.5 12.5l5 5L19.5 7" />);
export const IcX = (p: P) => base(p, <path d="M6 6l12 12M18 6L6 18" />);
export const IcAlert = (p: P) => base(p, <><path d="M12 3.5L22 20H2z" /><path d="M12 10v4.5" /><circle cx="12" cy="17" r="0.4" fill="currentColor" /></>);
export const IcInfo = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.4" fill="currentColor" /></>);
export const IcExternal = (p: P) => base(p, <><path d="M10 5H5v14h14v-5" /><path d="M14 4h6v6" /><path d="M20 4L11 13" /></>);
export const IcDownload = (p: P) => base(p, <><path d="M12 4v11M7.5 11L12 15.5 16.5 11" /><path d="M4.5 19.5h15" /></>);
export const IcBook = (p: P) => base(p, <><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15.5H6.5A2.5 2.5 0 004 21z" /><path d="M4 18.5A2.5 2.5 0 016.5 16H20" /></>);
export const IcNetwork = (p: P) => base(p, <><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="7" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M8 7l8-.6M7 8l3.8 8M17 9l-3.8 7.4" /></>);
export const IcSpark = (p: P) => base(p, <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>);
export const IcPen = (p: P) => base(p, <><path d="M4 20l.9-3.6L16.4 4.9a1.8 1.8 0 012.6 0l.1.1a1.8 1.8 0 010 2.6L7.6 19.1z" /><path d="M14.5 6.8l2.7 2.7" /></>);
export const IcTrash = (p: P) => base(p, <><path d="M4.5 6.5h15M9.5 6V4.5h5V6" /><path d="M6.5 6.5L7.5 20h9l1-13.5" /><path d="M10 10.5v6M14 10.5v6" /></>);
export const IcRestore = (p: P) => base(p, <><path d="M4 5v5h5" /><path d="M4.6 10A8 8 0 108 5.2" /></>);
export const IcRefresh = (p: P) => base(p, <><path d="M20 5v5h-5" /><path d="M19.4 10a8 8 0 10.6 4" /></>);
export const IcChevron = (p: P) => base(p, <path d="M8 10l4 4 4-4" />);
export const IcShield = (p: P) => base(p, <><path d="M12 3l7.5 3v6c0 4.5-3 7.7-7.5 9-4.5-1.3-7.5-4.5-7.5-9V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>);
export const IcEye = (p: P) => base(p, <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IcDatabase = (p: P) => base(p, <><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></>);
export const IcClock = (p: P) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>);
export const IcLink = (p: P) => base(p, <><path d="M10 14a4.5 4.5 0 006.4.4l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5" /><path d="M14 10a4.5 4.5 0 00-6.4-.4l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5" /></>);
