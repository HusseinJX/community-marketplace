"use client";

import { SWRConfig } from "swr";

// App-wide SWR cache. The cache is a module-scoped Map that lives for the life
// of the SPA session, so it survives component unmount/remount — navigating
// away from a tab and back reads cached data instantly and revalidates in the
// background instead of refetching from scratch every time.
//
// Defaults tuned for a mobile-first app that spends a lot of time backgrounded:
// - revalidateOnFocus off: don't stampede every endpoint each time the native
//   app returns to the foreground (live surfaces opt back in via refreshInterval).
// - dedupingInterval 30s: identical keys requested within 30s share one request,
//   so rapid tab-switching never refetches.
// - keepPreviousData: no loading flash when a key's params change (e.g. filters).
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        keepPreviousData: true,
        // Default fetcher: JSON GET. Hooks that need custom parsing pass their own.
        fetcher: (url: string) =>
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`Request failed: ${r.status}`);
            return r.json();
          }),
      }}
    >
      {children}
    </SWRConfig>
  );
}
