// Hand-crafted SVG icons — no external icon library needed.
// Every icon uses a consistent 24×24 viewBox, currentColor stroke, round caps/joins.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 24): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function IconArrowUp({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export function IconTarget({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function IconCrosshair({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M22 12h-4M6 12H2M12 6V2M12 22v-4" />
    </svg>
  );
}

export function IconFlag({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function IconShield({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconBan({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

export function IconBeached({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M5 14l3-6 10 3-2 6-10-3z" />
      <path d="M8 8l2-3 4 1 1 4" />
      <path d="M7.5 14.5l3 .9M14 16.4l2 .6" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function IconMissing({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 5h12a3 3 0 013 3v8a3 3 0 01-3 3H8a3 3 0 01-3-3v-3" />
      <path d="M9 9h6v5H9z" />
      <path d="M2 2l20 20" />
      <circle cx="8" cy="19" r="1" />
      <circle cx="16" cy="19" r="1" />
    </svg>
  );
}

export function IconAlertTriangle({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconCheck({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconDatabase({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export function IconDownload({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconUpload({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function IconRotateCcw({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

export function IconSearch({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// Tab bar icons
export function IconClipboard({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

export function IconBarChart({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function IconHardDrive({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="22" y1="12" x2="2" y2="12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </svg>
  );
}

// Live match specific icons
export function IconZap({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconStar({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function IconAlertCircle({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function IconPlay({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function IconSquare({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

export function IconChevronRight({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconChevronLeft({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconSend({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function IconCheckCircle({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function IconTruck({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

export function IconGraduationCap({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M22 10l-10-5L2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      <path d="M22 10v6" />
    </svg>
  );
}

export function IconUser({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconUsers({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function IconSwap({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}
