"use client";

import type { SVGProps } from "react";

/**
 * Brand marks for the social links on a business profile.
 *
 * These were EMOJI — 📸 for Instagram, 🎵 for TikTok, ☁️ for SoundCloud, 💼
 * for LinkedIn. Emoji render as a different picture on every operating system,
 * sit on their own coloured background inside otherwise monochrome UI, and are
 * the single fastest way to make a page look unfinished. A profile is the page
 * a business sends people to; it cannot be the page that looks like a draft.
 *
 * Lucide dropped brand icons over trademark concerns, so these are inlined as
 * simple monochrome glyphs that take `currentColor` — recognisable at 16px,
 * which is all a link row needs, and tinted by whatever the row's colour is.
 */

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export function InstagramIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon(props: P) {
  return (
    <svg {...base(props)}>
      {/* The note-and-hook silhouette, simplified to strokes. */}
      <path d="M14 3v11.2a3.6 3.6 0 1 1-3-3.55" />
      <path d="M14 6.2A5.2 5.2 0 0 0 19.2 10" />
    </svg>
  );
}

export function XIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

export function ThreadsIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 21c-5 0-8-3.4-8-9s3-9 8-9c3.6 0 6 1.8 7 4.4" />
      <path d="M9.4 14.2c.6 1.1 1.9 1.7 3.2 1.5 1.7-.2 2.8-1.3 2.6-2.7-.2-1.5-2-2.3-4-2-1.4.2-2.4.9-2.4 1.9" />
      <path d="M15.2 11c1.6.5 2.6 1.6 2.6 3.1 0 2.3-2.2 3.9-5.4 3.9" />
    </svg>
  );
}

export function YouTubeIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="5" width="20" height="14" rx="4.5" />
      <path d="M10.2 9.3l4.6 2.7-4.6 2.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <path d="M15 8h-1.6c-.9 0-1.4.6-1.4 1.4V11H15m-3 0h-2m2 0v6.5" />
    </svg>
  );
}

export function LinkedInIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4.5" />
      <path d="M7 10.5v6.5M7 7.4v.1" />
      <path d="M11.5 17v-6.5M11.5 13.2c0-1.5 1-2.7 2.5-2.7s2.5 1.1 2.5 2.7V17" />
    </svg>
  );
}

export function SpotifyIcon(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.2 9.4c3.2-.9 6.4-.6 9.2 1" />
      <path d="M7.8 12.4c2.6-.7 5.2-.4 7.5.8" />
      <path d="M8.4 15.2c2-.5 4-.3 5.8.6" />
    </svg>
  );
}

export function SoundCloudIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M3 16v-3.5M6 16v-5.5M9 16V9M12 16V7.5" />
      <path d="M15 16V8.6a4 4 0 0 1 6 3.4v.5a3.5 3.5 0 0 1 0 3.5z" />
    </svg>
  );
}

export function TicketIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2.5 2.5 0 0 0 0 5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2.5 2.5 0 0 0 0-5z" />
      <path d="M14 7v10" strokeDasharray="2 2" />
    </svg>
  );
}

export function GuitarIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M20.5 3.5l-4 4" />
      <path d="M16.5 7.5l-1.6-1.6-3.2 3.2a4.5 4.5 0 0 0-6 6.5 4.5 4.5 0 0 0 6.5-6l3.2-3.2z" />
      <circle cx="9" cy="15" r="1.6" />
    </svg>
  );
}

export function UsersIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.6 5.2a3.2 3.2 0 0 1 0 5.6" />
    </svg>
  );
}

export function PinIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </svg>
  );
}

export function LinkIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M10 13a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 11a4 4 0 0 0-5.7-.4l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </svg>
  );
}
