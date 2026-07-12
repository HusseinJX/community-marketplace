"use client";

import Script from "next/script";
import { Mail } from "lucide-react";

// Inline Calendly booking widget. The URL comes from NEXT_PUBLIC_CALENDLY_URL so
// it can be set/changed per environment without a code change. Until it's set we
// show a graceful "booking opens soon" fallback so the page is safe to ship.
// Calendly's widget.js auto-initializes any .calendly-inline-widget on load.
export function CalendlyEmbed({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
        <p className="text-sm font-semibold text-stone-900">Booking opens soon</p>
        <p className="mt-1 text-sm text-stone-500">
          Want in now? Email us and we&apos;ll set up a time.
        </p>
        <a
          href="mailto:hello@whatslocal.ai?subject=On-camera%20interview"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          <Mail className="h-4 w-4" /> hello@whatslocal.ai
        </a>
      </div>
    );
  }

  return (
    <>
      <div
        className="calendly-inline-widget overflow-hidden rounded-2xl border border-stone-200"
        data-url={url}
        style={{ minWidth: "320px", height: "700px" }}
      />
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />
    </>
  );
}
