"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getConsent, onConsentChange } from "@/lib/consent";

// Third-party ad/retargeting pixels — Meta (Facebook/Instagram) + Google (Ads +
// GA4). All env-gated: each no-ops until its ID is set, matching the app's
// "no-op until configured" convention. Google uses Consent Mode v2 (tag loads
// with consent DENIED by default, cookieless, then flips to GRANTED on accept);
// Meta only loads at all once the user accepts.
//
// IDs:
//   NEXT_PUBLIC_META_PIXEL_ID    — 16-digit Meta Pixel ID
//   NEXT_PUBLIC_GA4_ID           — "G-XXXXXXX" GA4 Measurement ID
//   NEXT_PUBLIC_GOOGLE_ADS_ID    — "AW-XXXXXXXXX" Google Ads tag ID

const META = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const ADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...a: unknown[]) => void };
    _fbq?: unknown;
  }
}

// Load the Google tag base with Consent Mode defaulted to denied. Safe pre-consent
// (sends cookieless, modeled pings — the whole point of Consent Mode v2).
function loadGoogleBase() {
  if ((!GA4 && !ADS) || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => window.dataLayer!.push(args);
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4 || ADS}`;
  document.head.appendChild(s);
  if (GA4) gtag("config", GA4);
  if (ADS) gtag("config", ADS);
}

function grantGoogle() {
  window.gtag?.("consent", "update", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
}

// The standard Meta Pixel bootstrap — only ever called once, after consent.
function loadMeta() {
  if (!META || window.fbq) return;
  /* eslint-disable */
  (function (f: any, b: any, e: string, v: string, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq!("init", META);
  window.fbq!("track", "PageView");
}

export function AdPixels() {
  const pathname = usePathname();
  const granted = useRef(false);

  useEffect(() => {
    loadGoogleBase();
    const apply = (state: string) => {
      if (state !== "granted") return;
      granted.current = true;
      grantGoogle();
      loadMeta();
    };
    if (getConsent() === "granted") apply("granted");
    return onConsentChange(apply);
  }, []);

  // SPA route changes — fire a fresh PageView on each navigation once granted.
  // (The first PageView is fired inline at load by loadMeta/config.)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!granted.current || !pathname) return;
    window.fbq?.("track", "PageView");
    window.gtag?.("event", "page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}
