"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { clearDemoCookies } from "@/lib/demo-admin";

// Admin demo is entered via the "Admin demo" button, which sets a cookie that
// unlocks the vendor portal without auth. It should end the moment you go back
// to the shopper side — so whenever the current page isn't an admin surface
// (the vendor portal, the /demo launcher, or the /share?vendor=1 composer), we
// clear the cookie. Mounted app-wide.
export function DemoExitWatcher() {
  const pathname = usePathname();
  useEffect(() => {
    const p = pathname ?? "";
    const vendorShare =
      p === "/share" && new URLSearchParams(window.location.search).get("vendor") === "1";
    const inAdminArea = p.startsWith("/vendor") || p.startsWith("/demo") || vendorShare;
    if (!inAdminArea) clearDemoCookies();
  }, [pathname]);
  return null;
}
